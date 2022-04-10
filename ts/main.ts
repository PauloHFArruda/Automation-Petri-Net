import { PetriNetManager } from './PetriNet.js';
import Vector from './utils/Vector.js';
import ToolBar from './ToolBar.js';
import { PropertyWindow } from './PropertyWindow.js';
import { createSimulator, Simulator } from './Simulation.js'
import { InputConfig } from './InputsConfig.js';

function addListeners(toolBar) {
    console.log('adding listeners');
    const eventNames = ['mousedown', 'mouseup', 'mousemove', 'mouseleave', 'wheel']
    const svg = document.getElementById('my-svg')
    for (let name of eventNames) {
        svg.addEventListener(name, (evt) => { toolBar[name](evt) });
    }
    document.body.addEventListener('keydown', (evt) => { toolBar.keydown(evt) });
    for (let tool in toolBar.tools) {
        document.getElementById(tool)
            .addEventListener('mousedown', (evt) => { toolBar.changeTool(tool) });
    }
}

function testNetManager(netManager: PetriNetManager) {
    const placeId = netManager.createPlace(new Vector(100, 50))
    const placeId2 = netManager.createPlace(new Vector(50, 100))
    const placeId3 = netManager.createPlace(new Vector(150, 150))
    
    const transId = netManager.createTrans(new Vector(150, 50))
    const transId2 = netManager.createTrans(new Vector(75, 150))
    const transId3 = netManager.createTrans(new Vector(50, 50))
    
    const arcId = netManager.createArc(placeId2, transId2, "Output")
    const arcId2 = netManager.createArc(placeId, transId, "Input")
    const arcId3 = netManager.createArc(placeId, transId2, "Inhibitor")
    
    netManager.createArc(placeId3, transId2, "Input")
    netManager.createArc(placeId2, transId3, "Input")
    netManager.createArc(placeId, transId3, "Output")
    netManager.createArc(placeId3, transId, "Output")

    netManager.zoom(new Vector(100, 100), 0.7)
    netManager.moveScreen(new Vector(20, 20))

    netManager.selectPE(placeId)

    netManager.setGenericPEAttr(arcId, 'weight', '2')
    netManager.setGenericPEAttr(arcId2, 'weight', '2')
    netManager.setGenericPEAttr(arcId3, 'weight', '3')
    netManager.setGenericPEAttr(placeId, 'initialMark', '6')
    netManager.setGenericPEAttr(placeId3, 'initialMark', '7')

    netManager.removeElement(placeId)
    netManager.undo()
    netManager.undo()
    netManager.undo()
    netManager.undo()
    netManager.undo()

    netManager.redo()
    netManager.redo()
    netManager.redo()
    netManager.redo()

    netManager.undo()
}

function testSimulator(netManager: PetriNetManager, simulator: Simulator) {
    const placeId1 = netManager.createPlace(new Vector(150, 50))
    const placeId2 = netManager.createPlace(new Vector(100, 150))
    const placeId3 = netManager.createPlace(new Vector(200, 150))
    const placeId4 = netManager.createPlace(new Vector(300, 200))
    const placeId5 = netManager.createPlace(new Vector(50, 200))

    const transId1 = netManager.createTrans(new Vector(150, 100))
    const transId2 = netManager.createTrans(new Vector(150, 200))
    const transId3 = netManager.createTrans(new Vector(50, 50))

    netManager.createArc(placeId1, transId1, "Input")
    netManager.createArc(placeId2, transId1, "Output")
    netManager.createArc(placeId3, transId1, "Output")
    netManager.createArc(placeId2, transId2, "Input")
    netManager.createArc(placeId3, transId2, "Input")
    netManager.createArc(placeId4, transId2, "Output")
    netManager.createArc(placeId5, transId2, "Output")
    netManager.createArc(placeId5, transId3, "Input")
    netManager.createArc(placeId1, transId3, "Output")

    netManager.setGenericPEAttr(placeId1, 'initialMark', '1')
    
    netManager.net.inputs = [
        {
            name: 's1', 
            type: 'BOOL', 
            initialValue: 'false', 
            description: ''
        },
        {
            name: 's2', 
            type: 'BOOL', 
            initialValue: 'true', 
            description: ''
        },
        {
            name: 's3', 
            type: 'BOOL', 
            initialValue: 'true', 
            description: ''
        },
    ]
    netManager.setGenericPEAttr(transId1, 'guard', 's1 and s2')
    netManager.setGenericPEAttr(transId3, 'guard', 's1 AND (s2 OR NOT s3)')

    netManager.moveScreen(new Vector(50, 0))

    simulator.start()
}

function main() {
    console.log('Creating net')
    const netManager = new PetriNetManager()
    const toolBar = new ToolBar(netManager)
    const inputConfig = new InputConfig()
    document.getElementById('inputs-button')
        .onclick = () => { 
            inputConfig.open(
                netManager.net.inputs,
                inputs => { netManager.net.inputs = inputs }
            ) 
        }
    const propertyWindow = new PropertyWindow()
    netManager.selectObserver = (PEId: string) => {
        const genericPE = netManager.getPE(PEId)
        propertyWindow.open(
            genericPE.PEType,
            (attr, val) => { 
                netManager.setGenericPEAttr(PEId, attr, val) 
            },
            genericPE
        )
    }
    netManager.deselectObserver = () => { propertyWindow.close() }
    addListeners(toolBar)
    const simulator = createSimulator(netManager.net)

    // testNetManager(netManager)
    testSimulator(netManager, simulator)
}

window.onload = main