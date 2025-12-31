import { TFunction } from "i18next";
import { Transaction } from "kysely";

export interface IContextVariableMap<DB> {
  trx: Transaction<DB>;
  t: TFunction;
  // Feature flags support
  'feature-flags': (key: string, defaultValue?: any) => any;
  'feature-enabled': (key: string, defaultValue?: boolean) => boolean;
}

export interface Context<DB> {
  var: IContextVariableMap<DB>;
}

export class CustomContext<DB> implements Context<DB> {
  public var: IContextVariableMap<DB>;
  constructor(ctxVar: IContextVariableMap<DB>) {
    this.var = ctxVar;
  }
}
