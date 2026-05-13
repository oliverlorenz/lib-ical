import { ICalComponent, ICalProperty } from './types';

export class Parser {
  private static unfoldLines(input: string): string[] {
    return input
      .replace(/\r\n[ \t]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n[ \t]/g, '')
      .split('\n')
      .filter((line) => line.length > 0);
  }

  private static splitNameValue(line: string): [string, string] {
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuote = !inQuote;
      } else if (line[i] === ':' && !inQuote) {
        return [line.substring(0, i), line.substring(i + 1)];
      }
    }
    throw new Error(`Invalid iCal line (no colon found): ${line}`);
  }

  private static parseLine(line: string): ICalProperty {
    const [nameAndParams, value] = Parser.splitNameValue(line);
    const parts = nameAndParams.split(';');
    const name = parts[0];
    const params: Record<string, string> = {};

    for (let i = 1; i < parts.length; i++) {
      const eqIdx = parts[i].indexOf('=');
      if (eqIdx !== -1) {
        params[parts[i].substring(0, eqIdx)] = parts[i].substring(eqIdx + 1);
      }
    }

    return { name, params, value };
  }

  public parse(input: string): ICalComponent {
    const lines = Parser.unfoldLines(input);
    const stack: ICalComponent[] = [];
    let root: ICalComponent | null = null;

    for (const line of lines) {
      const prop = Parser.parseLine(line);

      if (prop.name === 'BEGIN') {
        const component: ICalComponent = { name: prop.value, properties: [], components: [] };
        if (stack.length > 0) {
          stack[stack.length - 1].components.push(component);
        }
        stack.push(component);
      } else if (prop.name === 'END') {
        const component = stack.pop();
        if (!component || component.name !== prop.value) {
          throw new Error(`Mismatched END:${prop.value}`);
        }
        if (stack.length === 0) {
          root = component;
        }
      } else {
        if (stack.length === 0) {
          throw new Error(`Property outside component: ${line}`);
        }
        stack[stack.length - 1].properties.push(prop);
      }
    }

    if (!root) {
      throw new Error('No root component found');
    }

    return root;
  }
}
