export interface Schema {
    project: string;
    domain: string;
    vapidPublicKey: string;
    vapidPrivateKey: string;
    clientProject?: string;
    name?: string;
    path?: string;
    module?: any;
    haveBodyParser?: boolean;
}