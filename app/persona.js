import { registerComponent, Signal } from "@venajs/core";

registerComponent('l-persona-selector', ({ render, element, attributes, refs }) => {
  const { id, ...rest } = attributes; // ignore `id`

  const selected = new Signal(personas[0]);
  selected.on(rerender);
  rerender();

  Object.defineProperty(element, 'value', {
    get() {
      return personas.find(persona => persona.name === refs.persona.value);
    }
  });

  function rerender() {
    render`
      <style>
        :host {
          text-align: center;
        }
      </style>
      <select
        ${rest}
        id="persona"
        onchange=${e => selected.value = personas.find(persona => persona.name === e.target.value)}
      >
        ${personas.map(persona => `<option value="${persona.name}" ${selected.value === persona ? "selected" : ''}>${persona.name}</option>`)}
      </select>
      <div>&lt; ${selected.value.bio} &gt;</div>
    `;
  }
});

export const personas = [
  {
    name: "Bill",
    bio: "A dedicated software engineer",
  },
  {
    name: "Tiffany",
    bio: "An experienced software engineer",
  },
];
