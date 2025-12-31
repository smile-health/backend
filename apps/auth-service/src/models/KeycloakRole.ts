export class KeycloakRole {
  id?: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;

  constructor(data?: Partial<KeycloakRole>) {
    data = data || {};
    this.id = data.id;
    this.name = data.name!;
    this.description = data.description;
    this.composite = data.composite || false;
    this.clientRole = data.clientRole || false;
    this.containerId = data.containerId;
  }
}

export class KCUserRoleMap {
  id: string;
  name: string;

  constructor(data: Partial<KCUserRoleMap>) {
    this.id = data.id!;
    this.name = data.name!;
  }
}
