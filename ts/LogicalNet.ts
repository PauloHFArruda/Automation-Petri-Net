import { ArcData, ArcType, PEId, PetriNetData, PlaceData, PlaceType, SimConfig, TransData } from "./PNData"

type GuardFunc = (...args: any[]) => boolean

interface StepResult {
    currentTrans: LogicalTrans,
    isLastTrans: boolean,
}

class LogicalPlace {
    readonly id: PEId
    readonly name: string
    readonly placeType: PlaceType
    readonly initialMark: number
    mark: number

    constructor (data: PlaceData) {
        this.id = data.id
        this.name = data.name
        this.placeType = data.placeType
        try {
            this.initialMark = parseFloat(data.initialMark)
        } catch(e) {
            throw "Can't convert initialMark to Integer."
        }
        this.mark = this.initialMark
    }

    restart() {
        this.mark = this.initialMark
    }
}

class LogicalPetriArc {
    readonly id: PEId
    readonly place: LogicalPlace
    readonly arcType: ArcType
    readonly weight: number

    constructor (data: ArcData, place: LogicalPlace) {
        this.id = data.id
        this.place = place
        this.arcType = data.arcType
        try {
            this.weight = parseFloat(data.weight)
        } catch(e) {
            throw "Can't convert weight to Integer."
        }
    }

    isEnable() {
        if (this.arcType === 'Input' || this.arcType === 'Test')
            return this.weight <= this.place.mark
        if (this.arcType === 'Inhibitor')
            return this.weight >= this.place.mark
        if (this.place.placeType === 'BOOL')
            return !this.place.mark

        return true
    }
}

class LogicalTrans {
    readonly id: PEId
    readonly inputsArcs: LogicalPetriArc[]
    readonly outputsArcs: LogicalPetriArc[]
    readonly testArcs: LogicalPetriArc[]
    readonly inhibitorArcs: LogicalPetriArc[]
    readonly guard: string
    readonly delay: number
    // readonly priority: number
    private readonly guardFunc: GuardFunc
    private timeToEnable: number
    private _isGuardEnable: boolean
    private _isEnable: boolean

    constructor(data: TransData, netInputNames: string[]) {
        this._isEnable = false
        this.id = data.id
        try {
            this.delay = parseFloat(data.delay)
        } catch(e) {
            throw "Can't convert delay to float."
        }
        // try {
        //     this.priority = parseFloat(data.priority)
        // } catch(e) {
        //     throw "Can't convert priority to float."
        // }
        this.guard = data.guard
        if (data.guard) {
            try {
                this.guardFunc = this.createGuardFunc(
                    data.guard, netInputNames
                )
            } catch(e) {
                throw 'Invalid guard expression'
            }
        } else {
            this.guardFunc = (...args) => true
        }

        this.inputsArcs = []
        this.outputsArcs = []
        this.testArcs = []
        this.inhibitorArcs = []

        this.timeToEnable = this.delay
        this._isGuardEnable = false
    }

    private createGuardFunc(guard: string, inputNames: string[]): GuardFunc {
        const decodedGuard = guard
            .replaceAll(/(?<=(\)|\s))and(?=(\(|\s))/gi, '&&')
            .replaceAll(/(?<=(\)|\s))or(?=(\(|\s))/gi, '||')
            .replaceAll(/(?<=(\(|\)|\s|^))not(?=(\(|\s))/gi, '!')
        return eval(`(${inputNames.join(',')}, rt, ft) => ${decodedGuard}`)
    }

    addArc(arc: LogicalPetriArc) {
        if (arc.arcType === 'Input')
            this.inputsArcs.push(arc)
        if (arc.arcType === 'Output')
            this.outputsArcs.push(arc)
        if (arc.arcType === 'Test')
            this.testArcs.push(arc)
        if (arc.arcType === 'Inhibitor')
            this.inhibitorArcs.push(arc)
    }

    getArcs() {
        return [...this.inputsArcs, 
            ...this.outputsArcs, 
            ...this.testArcs, 
            ...this.inhibitorArcs]
    }

    restart() {
        this.timeToEnable = 0
        this._isEnable = false
    }

    checkArcs() {
        // for (const arc of [...this.inputsArcs, ...this.testArcs]) {
        //     if (arc.place.mark < arc.weight)
        //         return false
        // }

        // for (const arc of this.inhibitorArcs) {
        //     if (arc.place.mark >= arc.weight)
        //         return false
        // }

        // for (const arc of this.outputsArcs) {
        //     if (arc.place.placeType === 'BOOL' && arc.place.mark === 1)
        //         return false
        // }
        for (const arc of this.getArcs()) {
            if (!arc.isEnable())
                return false
        }
        return true
    }

    update(
        dt: number, 
        netInputs: Map<string, number>,
        rt: (varName: string) => boolean,
        ft: (varName: string) => boolean
    ) {
        this._isEnable = false
        this._isGuardEnable = true
        this._isGuardEnable = this.guardFunc(
            ...netInputs.values(), rt, ft
        )
        if (this.checkArcs() && this._isGuardEnable) {
            if (this.timeToEnable > 0)
                this.timeToEnable -= dt
            else
                this._isEnable = true
        } else
            this.timeToEnable = this.delay
    }

    fire() {
        if (!this.isEnable()) throw "Can't fire a disabled transition"
        
        for (const arc of this.inputsArcs)
            arc.place.mark -= arc.weight
        
        for (const arc of this.outputsArcs)
            arc.place.mark += arc.weight

        this.timeToEnable = this.delay
    }

    isEnable() {
        return this._isEnable
    }

    isGuardEnable() {
        return this._isGuardEnable
    }

    isWaitingDelay() {
        return this.delay &&  this.timeToEnable < this.delay
    }
}


class LogicalNet {
    readonly places: { [id: PEId]: LogicalPlace }
    readonly arcs: { [id: PEId]: LogicalPetriArc }
    readonly transitions: { [id: PEId]: LogicalTrans }
    readonly transInOrder: LogicalTrans[]
    readonly simConfig: SimConfig

    constructor(netData: PetriNetData, netInputNames: string[]) {
        this.places = Object.fromEntries(netData.places.map(
            placeData => [placeData.id, new LogicalPlace(placeData)]
        ))
        this.arcs = Object.fromEntries(netData.arcs.map(
            arcData => [
                arcData.id, 
                new LogicalPetriArc(arcData, this.places[arcData.placeId])
            ]
        ))
        this.transitions = Object.fromEntries(netData.transitions.map(
            transData => [
                transData.id, 
                new LogicalTrans(transData, netInputNames)
            ]
        ))

        netData.arcs.forEach(arcData => {
            this.transitions[arcData.transId].addArc(this.arcs[arcData.id])
        })

        this.transInOrder = Object.values(this.transitions)
        this.simConfig = netData.simConfig
    }
}

export { LogicalPlace, LogicalTrans, LogicalPetriArc, LogicalNet }