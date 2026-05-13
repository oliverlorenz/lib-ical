import { ICalComponent, ICalProperty } from './types';

export class Serializer {
  private static foldLine(line: string): string {
    if (line.length <= 75) return line;

    const parts: string[] = [line.substring(0, 75)];
    let remaining = line.substring(75);

    while (remaining.length > 0) {
      parts.push(' ' + remaining.substring(0, 74));
      remaining = remaining.substring(74);
    }

    return parts.join('\r\n');
  }

  private static serializeProperty(prop: ICalProperty): string {
    let line = prop.name;
    for (const [key, value] of Object.entries(prop.params)) {
      line += `;${key}=${value}`;
    }
    line += `:${prop.value}`;
    return Serializer.foldLine(line);
  }

  public serialize(component: ICalComponent): string {
    const lines: string[] = [`BEGIN:${component.name}`];

    for (const prop of component.properties) {
      lines.push(Serializer.serializeProperty(prop));
    }

    for (const child of component.components) {
      lines.push(this.serialize(child));
    }

    lines.push(`END:${component.name}`);

    return lines.join('\r\n');
  }
}
