import Vector from "../utils/Vector.js";
import { PetriPlace, PetriTrans, PetriArc } from "./PetriNetElements.js";
class UndoRedoManager {
    undoList;
    redoList;
    constructor() {
        this.undoList = [];
        this.redoList = [];
    }
    registryChange(change) {
        this.undoList.push(change);
        this.redoList = [];
    }
    undo() {
        const lastChange = this.undoList.pop();
        if (lastChange) {
            lastChange.undo();
            this.redoList.push(lastChange);
            return true;
        }
        return false;
    }
    redo() {
        const lastChange = this.redoList.pop();
        if (lastChange) {
            lastChange.redo();
            this.undoList.push(lastChange);
            return true;
        }
        return false;
    }
}
function createSVGNet() {
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.innerHTML = `<rect id="svg-background" 
        x="-5000" y="-5000" 
        width="10000" height="10000" fill="white"/>
    <g id="elements">
        <g id="arcs"></g>
        <g id="pe"></g>
    </g>
    <g id="IEs"></g>`;
    svgElement.style.height = '100%';
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('viewBox', '0 0 1500 300');
    return svgElement;
}
export class PetriNet {
    static GRID_SIZE = 10;
    svgElement;
    elements;
    inputs;
    simConfig;
    preScript;
    placeNumber;
    transNumber;
    undoRedoManager;
    _grid;
    constructor() {
        this.svgElement = createSVGNet();
        this.elements = {};
        this.inputs = [];
        this.simConfig = {
            simMode: "Automation",
            arcDebug: false,
            guardDebug: false
        };
        this.preScript = "";
        this.placeNumber = 1;
        this.transNumber = 1;
        this._grid = false;
        this.undoRedoManager = new UndoRedoManager();
    }
    generateId() {
        return window.crypto.randomUUID();
    }
    get grid() {
        return this._grid;
    }
    set grid(val) {
        if (val) {
            document.getElementById('svg-background')
                .setAttribute('fill', 'url(#grid-pattern)');
        }
        else {
            document.getElementById('svg-background')
                .setAttribute('fill', 'white');
        }
        this._grid = val;
    }
    getGenericPE(id) {
        return this.elements[id];
    }
    getGenericPEType(id) {
        return this.elements[id].PEType;
    }
    getGenericPEData(id) {
        return this.elements[id].getData();
    }
    selectPE(id) {
        this.elements[id].select();
    }
    deselectPE(id) {
        this.elements[id].deselect();
    }
    fitToGrid(pos) {
        return new Vector(Math.round(pos.x / PetriNet.GRID_SIZE) * PetriNet.GRID_SIZE, Math.round(pos.y / PetriNet.GRID_SIZE) * PetriNet.GRID_SIZE);
    }
    getMousePosition(evt, ignoreGrid = true) {
        const CTM = this.svgElement.getScreenCTM();
        const pos = new Vector((evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
        if (!ignoreGrid && this.grid)
            return this.fitToGrid(pos);
        return pos;
    }
    addGenericPE(genericPE, registryChange = true) {
        if (genericPE.PEType === 'arc') {
            let arc = genericPE;
            let place = this.elements[arc.placeId];
            let trans = this.elements[arc.transId];
            if (place.PEType !== 'place' || trans.PEType !== 'trans') {
                throw "Invalid placeId or transId";
            }
            this.svgElement.querySelector('#arcs')
                .appendChild(genericPE.svgElement);
            place.connectArc(arc.id);
            trans.connectArc(arc.id);
            arc.updatePlacePos();
            arc.updateTransPos();
        }
        else {
            let petriElement = genericPE;
            if (petriElement.connectedArcs.length) {
                throw "Can't add a place or trans with connected arcs";
            }
            this.svgElement.querySelector('#pe')
                .appendChild(genericPE.svgElement);
        }
        this.elements[genericPE.id] = genericPE;
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => this.removeGenericPE(genericPE.id, false),
                redo: () => this.addGenericPE(genericPE, false)
            });
        }
    }
    removeGenericPE(id, registryChange = true) {
        const genericPE = this.elements[id];
        if (this.elements[id].PEType === 'arc') {
            const arc = genericPE;
            const place = this.elements[arc.placeId];
            const trans = this.elements[arc.transId];
            place.disconnectArc(arc.id);
            trans.disconnectArc(arc.id);
        }
        else {
            const petriElement = this.elements[id];
            while (petriElement.connectedArcs.length) {
                this.removeGenericPE(petriElement.connectedArcs[0]);
            }
        }
        genericPE.svgElement.remove();
        delete this.elements[id];
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => this.addGenericPE(genericPE, false),
                redo: () => this.removeGenericPE(genericPE.id, false)
            });
        }
        return genericPE;
    }
    setGenericPEAttr(id, attrName, val, registryChange = true) {
        const ele = this.elements[id];
        const previousValue = ele[attrName];
        ele[attrName] = val;
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => this.setGenericPEAttr(id, attrName, previousValue, false),
                redo: () => this.setGenericPEAttr(id, attrName, val, false),
            });
        }
    }
    moveGenegic(currentPos, displacement, initialPos, setPos, registryChange, ignoreGrid) {
        const _initialPos = initialPos ? initialPos : currentPos;
        let targetPos = _initialPos.add(displacement);
        if (!ignoreGrid && this.grid)
            targetPos = this.fitToGrid(currentPos);
        setPos(targetPos);
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => setPos(_initialPos),
                redo: () => setPos(targetPos),
            });
        }
        return _initialPos;
    }
    movePE(id, displacement, registryChange = true, ignoreGrid = false, initialPos = null) {
        const genericPE = this.elements[id];
        if (genericPE.PEType === 'arc')
            return;
        const petriElement = genericPE;
        const _initialPos = initialPos ? initialPos : petriElement.position;
        petriElement.position = _initialPos.add(displacement);
        if (!ignoreGrid && this.grid)
            petriElement.position = this.fitToGrid(petriElement.position);
        for (const arcId of petriElement.connectedArcs) {
            const arc = this.elements[arcId];
            if (genericPE.PEType === 'place')
                arc.updatePlacePos();
            else
                arc.updateTransPos();
        }
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => this.movePE(id, new Vector(0, 0), false, true, _initialPos),
                redo: () => this.movePE(id, displacement, false, true, _initialPos),
            });
        }
        return _initialPos;
    }
    addArcCorner(arcId, cornerIndex, registryChange = true) {
        const arc = this.elements[arcId];
        arc.addCorner(cornerIndex);
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => arc.removeCorner(cornerIndex),
                redo: () => this.addArcCorner(arcId, cornerIndex, false),
            });
        }
    }
    moveArcCorner(arcId, cornerIndex, displacement, registryChange = true, ignoreGrid = false, initialPos = null) {
        const arc = this.elements[arcId];
        const _initialPos = initialPos ? initialPos : arc.getCornerPos(cornerIndex);
        arc.moveCorner(cornerIndex, _initialPos.add(displacement));
        if (!ignoreGrid && this.grid)
            arc.moveCorner(cornerIndex, this.fitToGrid(arc.getCornerPos(cornerIndex)));
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => this.moveArcCorner(arcId, cornerIndex, new Vector(0, 0), false, true, _initialPos),
                redo: () => this.moveArcCorner(arcId, cornerIndex, displacement, false, true, _initialPos),
            });
        }
        return _initialPos;
    }
    movePEText(id, attrName, displacement, registryChange = true, initialPos = null) {
        const genericPE = this.elements[id];
        const _initialPos = initialPos ?
            initialPos :
            genericPE.getPETextPosition(attrName);
        genericPE.setPETextPosition(attrName, _initialPos.add(displacement));
        if (registryChange) {
            this.undoRedoManager.registryChange({
                undo: () => this.movePEText(id, attrName, new Vector(0, 0), false, _initialPos),
                redo: () => this.movePEText(id, attrName, displacement, false, _initialPos),
            });
        }
        return _initialPos;
    }
    createPlace(coord) {
        const place = new PetriPlace(this.generateId());
        place.name = 'p' + this.placeNumber++;
        place.position = coord;
        this.addGenericPE(place);
        return place.id;
    }
    createTrans(coord) {
        const trans = new PetriTrans(this.generateId());
        trans.name = 't' + this.transNumber++;
        trans.position = coord;
        this.addGenericPE(trans);
        return trans.id;
    }
    createArc(placeId, transId, arcType) {
        const arc = new PetriArc(this.generateId(), this.getGenericPE(placeId), this.getGenericPE(transId), arcType);
        this.addGenericPE(arc);
        return arc.id;
    }
    undo() {
        return this.undoRedoManager.undo();
    }
    redo() {
        return this.undoRedoManager.redo();
    }
    addIE(element) {
        document.getElementById('IEs').appendChild(element);
    }
    moveScreen(displacement) {
        const viewBox = this.svgElement.viewBox.baseVal;
        viewBox.x -= displacement.x;
        viewBox.y -= displacement.y;
    }
    zoom(focusPoint, scale) {
        const viewBox = this.svgElement.viewBox.baseVal;
        viewBox.x += (focusPoint.x - viewBox.x) * (1 - scale);
        viewBox.y += (focusPoint.y - viewBox.y) * (1 - scale);
        viewBox.width = viewBox.width * scale;
        viewBox.height = viewBox.height * scale;
    }
    static loadPlace(data) {
        const place = new PetriPlace(data.id);
        place.name = data.name;
        place.placeType = data.placeType;
        place.initialMark = data.initialMark;
        place.position = new Vector(data.position.x, data.position.y);
        for (const [attrName, pos] of Object.entries(data.textsPosition)) {
            place.setPETextPosition(attrName, pos);
        }
        return place;
    }
    static loadTrans(data) {
        const trans = new PetriTrans(data.id);
        trans.name = data.name;
        trans.delay = String(data.delay);
        trans.guard = data.guard;
        trans.position = new Vector(data.position.x, data.position.y);
        for (const [attrName, pos] of Object.entries(data.textsPosition)) {
            trans.setPETextPosition(attrName, pos);
        }
        return trans;
    }
    static loadArc(data, net) {
        const arc = new PetriArc(data.id, net.getGenericPE(data.placeId), net.getGenericPE(data.transId), data.arcType);
        arc.weight = data.weight;
        if (data.corners) {
            for (const corner of data.corners.reverse()) {
                arc.addCorner(0);
                arc.moveCorner(0, new Vector(corner.x, corner.y));
            }
        }
        for (const [attrName, pos] of Object.entries(data.textsPosition)) {
            arc.setPETextPosition(attrName, pos);
        }
        return arc;
    }
    static newNet() {
        return new PetriNet();
    }
    getNetData() {
        const viewBox = this.svgElement.viewBox.baseVal;
        const elementsDataByPEType = Object.fromEntries(['place', 'trans', 'arc'].map(PEType => [
            PEType,
            Object.values(this.elements).filter((ele) => ele.PEType === PEType).map(ele => ele.getData())
        ]));
        return {
            name: 'Untiteled_Net',
            places: elementsDataByPEType['place'],
            transitions: elementsDataByPEType['trans'],
            arcs: elementsDataByPEType['arc'],
            inputs: this.inputs,
            grid: this.grid,
            nextPlaceNumber: this.placeNumber,
            nextTransNumber: this.transNumber,
            viewBox: {
                x: viewBox.x,
                y: viewBox.y,
                width: viewBox.width,
                heigth: viewBox.height
            },
            preScript: "",
            simConfig: this.simConfig
        };
    }
    static loadNet(data) {
        const net = new PetriNet();
        data.places.forEach(placeData => {
            net.addGenericPE(this.loadPlace(placeData), false);
        });
        data.transitions.forEach(transData => {
            net.addGenericPE(this.loadTrans(transData), false);
        });
        data.arcs.forEach(arcData => {
            net.addGenericPE(this.loadArc(arcData, net), false);
        });
        net.inputs = data.inputs;
        if (data.simConfig)
            net.simConfig = data.simConfig;
        const viewBox = net.svgElement.viewBox.baseVal;
        Object.assign(viewBox, data.viewBox);
        console.log(net);
        return net;
    }
}