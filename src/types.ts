export interface ICalProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

export interface ICalComponent {
  name: string;
  properties: ICalProperty[];
  components: ICalComponent[];
}
