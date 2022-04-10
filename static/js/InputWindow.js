const inputWindowDiv = document.getElementById("inputs-window");
class AGenericInput {
    constructor(inputType, inputName) {
        this.element = document.createElement('input');
        const label = document.createElement('label');
        this.element.type = inputType;
        label.className = "input-label";
        label.innerHTML = inputName;
        this.name = inputName;
        this.element.id = "input-" + inputName;
        label.setAttribute("for", this.element.id);
        inputWindowDiv.appendChild(this.element);
        inputWindowDiv.appendChild(label);
    }
}
class IntInput extends AGenericInput {
    constructor(inputData) {
        super('number', inputData.name);
        this.element.value = inputData.initialValue;
    }
    read() {
        return parseInt(this.element.value);
    }
}
class BoolInput extends AGenericInput {
    constructor(inputData) {
        super('checkbox', inputData.name);
        this.element.checked = inputData.initialValue === 'true';
    }
    read() {
        return this.element.checked ? 1 : 0;
    }
}
const InputsConstructorsByType = {
    'INT': IntInput,
    'BOOL': BoolInput
};
class InputWindow {
    constructor(inputs) {
        inputWindowDiv.innerHTML = '';
        this.inputs = [];
        for (const input of inputs) {
            this.inputs.push(new InputsConstructorsByType[input.type](input));
        }
    }
    readInputs() {
        return Object.fromEntries(this.inputs.map(input => [input.name, input.read()]));
    }
}
export { InputWindow };
