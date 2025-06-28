import { XMLParser } from 'fast-xml-parser';

export type InvariantCheck = (xmldoc: object) => void;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributesGroupName: "@_attrs",
});

export function parseXml(source: string, invariantChecks: InvariantCheck[] = []) {
	let xmldoc: object;
	try {
		xmldoc = parser.parse(source);
	} catch (e) {
		throw new Error(`error parsing XML:\n${(e as Error).message}`);
	}

	// check invariants
	for (let i = 0; i < invariantChecks.length; i++) invariantChecks[i](xmldoc);

	return xmldoc;
}