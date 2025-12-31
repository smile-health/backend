import { User } from "../schemas/userSchemas";

class KCUserCredential {
  temporary: boolean;
  type: string;
  value: string;
  constructor(data: Partial<KCUserCredential>) {
    this.temporary = data.temporary || false;
    this.type = data.type ?? "password";
    this.value = data.value ?? "smile";
  }
}

class KCUserAttributes {
  [key: string]: string[] | string | undefined;
  locale?: string;
  appUserId: string;
  programId?: string[];
  constructor(data?: Partial<KCUserAttributes>) {
    data = data || {};
    this.locale = data.locale;
    this.appUserId = data.appUserId!;
    this.programId = data.programId || [];
  }
}

export class KeycloakUser {
  id?: string;
  username: string;
  firstName: string;
  lastName?: string;
  email: string;
  emailVerified?: boolean;
  enabled?: boolean;
  credentials?: KCUserCredential[];
  requiredActions?: string[];
  attributes: KCUserAttributes;
  createdTimestamp?: number;
  totp?: boolean;
  disableableCredentialTypes?: string[];
  notBefore?: number;
  realmRoles?: string[];
  access?: { [key: string]: boolean };
  roleMappings?: {
    clientMappings?: Record<
      string,
      {
        mappings: {
          id: string;
          name: string;
          description?: string;
          composite: boolean;
          clientRole: boolean;
        }[];
      }
    >;
    realmMappings?: {
      id: string;
      name: string;
      description?: string;
      composite: boolean;
    }[];
  };

  constructor(
    data: Partial<KeycloakUser>,
    roleMappings?: KeycloakUser["roleMappings"]
  ) {
    this.id = data.id;
    this.username = data.username!;
    this.firstName = data.firstName!.replace(/[()\/\\":;,\s]/g, "");
    this.email = data.email!;
    this.emailVerified = data.emailVerified || true;
    this.enabled = data.enabled || true;
    this.credentials = data.credentials;
    this.requiredActions = data.requiredActions || [];
    this.attributes = data.attributes!;
    this.createdTimestamp = data.createdTimestamp;
    this.totp = data.totp;
    this.disableableCredentialTypes = data.disableableCredentialTypes;
    this.notBefore = data.notBefore;
    this.realmRoles = data.realmRoles;
    this.access = data.access;
    this.roleMappings = roleMappings;
  }

  toUser(): User {
    return {
      id: this.id!,
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName ?? "",
      email: this.email,
      emailVerified: this.emailVerified || true,
      enabled: this.enabled || true,
      requiredActions: this.requiredActions || [],
      createdTimestamp: this.createdTimestamp!,
      attributes: this.formatAttributesForUser(),
      access: this.access!,
      roleMappings: this.roleMappings,
    };
  }

  // Format attributes for user as the attribute value is an array, except for programId
  formatAttributesForUser(): KCUserAttributes {
    const attributes: KCUserAttributes = new KCUserAttributes();
    Object.keys(this.attributes).forEach((key: string) => {
      if (Array.isArray(this.attributes[key]) && key != "programId")
        attributes[key] = this.attributes[key][0];
      else attributes[key] = this.attributes[key]!;
    });
    return attributes;
  }
}
