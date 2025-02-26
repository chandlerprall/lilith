import { registerComponent, Signal } from "@venajs/core";
import { Persona } from "./session.mjs";

declare global {
	namespace Vena {
		interface Elements {
			"l-persona-selector": { id?: string };
		}
	}
}

export const personas: Array<Persona> = [
	{
		name: "Bill",
		bio: "A dedicated software engineer",
	},
	{
		name: "Tiffany",
		bio: "An experienced software engineer",
	},
];

registerComponent("l-persona-selector", ({ render, element: me, attributes, refs }) => {
	const { id, ...rest } = attributes; // ignore `id`, it gets applied to the root element

	const selected = new Signal(personas[0]);
	selected.on(rerender);
	rerender();

	Object.defineProperty(me, "value", {
		get() {
			return personas.find((persona) => persona.name === (refs.persona as HTMLInputElement).value);
		},
	});

	function rerender() {
		render(
			<>
				<style>{`
        :host {
          text-align: center;
        }
        `}</style>

				<select {...rest} id="persona" onchange={(e: Event) => (selected.value = personas.find((persona) => persona.name === (e.target! as HTMLSelectElement).value)!)}>
					{personas.map((persona) => (
						<option value={persona.name} selected={selected.value.name === persona.name}>
							{persona.name}
						</option>
					))}
				</select>
				<div>&lt; {selected.value.bio} &gt;</div>
			</>
		);
	}
});
