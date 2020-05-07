export interface Schema {
    domain: string;
    vapidPublicKey: string;
    vapidPrivateKey: string;
    haveBodyParser?: boolean;
    haveCors?: boolean;
    serverPath?: string;
    project?: string;
    module?: any;
    name?: string;
    path?: string;
}