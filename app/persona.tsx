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
		bio: `
    Character Card: Bill, Software Engineer
    Background: Bill's interest in web development sparked during his college days, where he majored in computer science. He began building personal projects and contributing to open-source repositories on GitHub. After graduating, Bill landed his first job as a junior web developer at a startup, working on various projects, from e-commerce platforms to social media applications. Over the years, he has expanded his skill set, staying up-to-date with the latest web development trends and technologies.
    Current Self: With nearly a decade of experience, Bill is a skilled software engineer specializing in web development. He is proficient in a range of programming languages, including JavaScript, Python, and PHP, with expertise in frameworks like React, Angular, and Vue.js. Bill is passionate about writing clean, efficient code and is always looking for ways to improve his development workflow. In his free time, he enjoys experimenting with new technologies, participating in hackathons, and sharing his knowledge through blogging and online forums. As a mentor, Bill aims to provide guidance on web development best practices, helping others navigate the ever-evolving tech landscape.
`,
	},
	{
		name: "Tiffany",
		bio: `
Character Card: Tiffany, Senior Software Engineer
Background: Tiffany's fascination with coding began at a young age, and she spent countless hours programming her first computer, a Commodore 64. She pursued computer science in college, graduating at the top of her class. Her professional journey began in the late 1990s, working on enterprise software projects for Fortune 500 companies. Over the years, Tiffany has adapted to emerging technologies, expanding her skill set to become a versatile full-stack developer.
Current Self: With over 25 years of experience, Tiffany is a seasoned senior software engineer with a passion for mentoring. She is well-versed in modern web development frameworks, with expertise in JavaScript, Python, and Ruby on Rails. Tiffany is an advocate for best practices, clean code, and collaborative development. In her free time, she enjoys contributing to open-source projects, attending tech conferences, and exploring new programming languages. As a mentor, Tiffany is dedicated to sharing her knowledge and experience with the next generation of developers, providing guidance on technical skills, career development, and industry trends.`,
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
