import { InsertChange } from '@schematics/angular/utility/change';
import { parseName } from '@schematics/angular/utility/parse-name';
import { buildDefaultPath } from '@schematics/angular/utility/project';
import { getFileContent } from '@schematics/angular/utility/test';
import { NodeDependencyType } from '@schematics/angular/utility/dependencies';
import { strings } from '@angular-devkit/core';
import { 
  chain,
  branchAndMerge,
  Rule,
  SchematicsException,
  Tree,
  SchematicContext
 } from '@angular-devkit/schematics';
 import { FileSystemSchematicContext } from '@angular-devkit/schematics/tools';
 import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
 import {
  buildRelativePath, 
  findModule, 
  MODULE_EXT, 
  ROUTING_MODULE_EXT
} from '@schematics/angular/utility/find-module';
import { getWorkspace } from '@schematics/angular/utility/config';
import { getProjectFromWorkspace } from '@angular/cdk/schematics/utils/get-project';
import { 
  addDependencyToPackageJson,
  getSourceRoot,
  appendHtmlElementToTag,
  createOrOverwriteFile,
  readIntoSourceFile
} from './cap-utils';
import {
  addProviderToModule,
  addImportToModule
 } from './vendored-ast-utils';
import { Schema as PWAOptions } from './schema';



function createPushService(tree: Tree, options: PWAOptions) {

  const pushServiceContent = 
  `
import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';


@Injectable({
    "providedIn": "root"
})
export class PushService {
    private actionUrl: string;
    private httpOptions: any;

    constructor(private http: HttpClient) {
        this.httpOptions = {
            headers: new HttpHeaders({ 
                'Content-Type': 'application/json'
            }),
            observe: "response"
        };

        this.actionUrl = '${options.domain}';
    }

    addPushSubscriber(sub:any) {
        return this.http.post('${options.domain}/api/notifications', sub);
    }

    send() {
        return this.http.post('${options.domain}/api/newsletter', null);
    }
}

`;

    const appServicePath = getSourceRoot(tree, options) + '/app/shared/services/push.service.ts';
    createOrOverwriteFile(tree, appServicePath, pushServiceContent);
}

function createAppComponent(tree: Tree, options: PWAOptions) {

  const appComponentContent = 
  `
import { Component } from '@angular/core';
import { SwUpdate } from "@angular/service-worker";
import { PushService } from "./shared/services/push.service";
import { SwPush } from "@angular/service-worker";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

    title = '${options.project}';
    sub: any;

    readonly VAPID_PUBLIC_KEY = "${options.vapidPublicKey}";

    constructor(
        private swUpdate: SwUpdate,
        private swPush: SwPush,
        private pushService: PushService) {
    }

    ngOnInit() {
        if (this.swUpdate.isEnabled) {
            this.swUpdate.available.subscribe(() => {
                if (confirm("New version available. Load New Version?")) {
                    window.location.reload();
                }
            });
        }
    }

    subscribeToNotifications() {
        this.swPush.requestSubscription({
            serverPublicKey: this.VAPID_PUBLIC_KEY
        })
        .then(sub => {
            this.sub = sub;
            console.log("Notification Subscription: ", sub);
            this.pushService.addPushSubscriber(sub)
                .subscribe(
                    () => console.log('Sent push subscription object to server.'),
                    err =>  console.log('Could not send subscription object to server, reason: ', err)
                );
        })
        .catch(err => console.error("Could not subscribe to notifications", err));
    }

    sendNewsletter() {
        console.log("Sending Newsletter to all Subscribers ...");
        this.pushService.send().subscribe();
    } 
}

`;

    const appComponentPath = getSourceRoot(tree, options) + '/app/app.component.ts';
    createOrOverwriteFile(tree, appComponentPath, appComponentContent);
}

function addDeclarationToNgModule(options: PWAOptions): Rule {
  return (host: Tree) => {
    const modulePath = options.module;

    // Import and include on Providers the PushService
    const source = readIntoSourceFile(host, modulePath);
    const servicePath = `${options.path}/app/shared/services/push.service`;
    const relativePath = buildRelativePath(modulePath, servicePath);
    const classifiedName = strings.classify(`PushService`);
    const providerRecorder = host.beginUpdate(modulePath);
    const providerChanges: any = addProviderToModule(
        source,
        modulePath,
        classifiedName,
        relativePath);

    for (const change of providerChanges) {
        if (change instanceof InsertChange) {
            providerRecorder.insertLeft(change.pos, change.toAdd);
        }
    }
    host.commitUpdate(providerRecorder);

    // Import and include on Imports the HttpClient
    () => {

        const source = readIntoSourceFile(host, modulePath);
        const relativePath = `@angular/common/http`;
        const classifiedName = strings.classify(`HttpClientModule`);
        const importRecorder = host.beginUpdate(modulePath);
        const importChanges: any = addImportToModule(
            source,
            modulePath,
            classifiedName,
            relativePath);

        for (const change of importChanges) {
            if (change instanceof InsertChange) {
                importRecorder.insertLeft(change.pos, change.toAdd);
            }
        }
        host.commitUpdate(importRecorder);
    }

    return host;
  };
}

function applyWebPushOnFront(options: PWAOptions): Rule {
  return (tree: Tree) => {

    // The app.component.ts is replaced moving the template or created..
    createAppComponent(tree, options);
    createPushService(tree, options);

    // On AppComponent html
    const addToAppComponentHtml = 
`
<div>
    <button class="button button-primary" (click)="subscribeToNotifications()" [disabled]="sub">Subscribe</button>
    <button class="button button-danger" (click)="sendNewsletter()">Send</button>
</div>
`;

    const appComponentHtmlPath = getSourceRoot(tree, options) + '/app/app.component.html';
    /** Appends the given element HTML fragment to the specified HTML file. Before o after */
    appendHtmlElementToTag(tree, appComponentHtmlPath, addToAppComponentHtml, 'right');
  }
}

function applyWebPushOnServer(options: PWAOptions): Rule {
    return (tree: Tree) => {

      // Add to configuration and api routes on server.js
      const addToServer = 
      `


/*
## How To show the Allow Notifications Dialog
If by accident we click "Deny" in the Allow Notifications dialog after hitting subscribe,
In order to trigger again the Allow Notifications popup, we need first to clear localhost from this list - [chrome://settings/content/notifications](chrome://settings/content/notifications)

## Generating VAPID keys
In order to generate a public/private VAPID key pair, we first need to install the [web-push](https://github.com/web-push-libs/web-push) library globally:

    npm install web-push -g

We can then generate a VAPID key pair with this command:

    web-push generate-vapid-keys --json

And here is a sample output of this command:

json
{
    "publicKey": "BF1BhDhSW89yKw6pWbLlzcDpCR3I3ViSCEiS_z0q_RP9-ablo5Up8HDIEP1-GauARtU7MxB6Yl_7FI8UvczPmaQ",
    "privateKey": "6XaIXj1cbSoaCpxSbOA-xYWHSISVSMCPUcSvEcczxkg"
}

*/


const webpush = require('web-push');

export let USER_SUBSCRIPTIONS = [];

export function addPushSubscriber(req, res) {
    const sub = req.body;
    console.log('Received Subscription on the server: ', sub);
    USER_SUBSCRIPTIONS.push(sub);
    res.status(200)
        .json({ message: "Subscription added successfully." });
}

export function sendNewsletter(req, res) {

    console.log('Total subscriptions', USER_SUBSCRIPTIONS.length);

    // sample notification payload
    const notificationPayload = {
        "notification": {
            "title": "Angular News",
            "body": "Newsletter Available!",
            "icon": "assets/icons/icon-96x96.png",
            "vibrate": [100, 50, 100],
            "data": {
                "dateOfArrival": Date.now(),
                "primaryKey": 1
            },
            "actions": [{
                "action": "explore",
                "title": "Go to the site"
            }]
        }
    };

    Promise.all(USER_SUBSCRIPTIONS.map(sub => webpush.sendNotification(
        sub, JSON.stringify(notificationPayload) )))
        .then(() => res.status(200).json({message: 'Newsletter sent successfully.'}))
        .catch(err => {
            console.error("Error sending notification, reason: ", err);
            res.sendStatus(500);
        });
}

const vapidKeys = {
    "publicKey":"${options.vapidPublicKey}",
    "privateKey":"${options.vapidPrivateKey}"
};

webpush.setVapidDetails(
    'mailto:example@yourdomain.org',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// REST API
app.route('/api/notifications')
    .post(addPushSubscriber);

app.route('/api/newsletter')
    .post(sendNewsletter);

      `;

        const appComponentPath = '/server.ts' || '/server.js';
        const appComponent = getFileContent(tree, appComponentPath);
        createOrOverwriteFile(tree, appComponentPath, appComponent.replace(`express();`, `express();` + addToServer));
    }
}

function addPackageJsonDependencies(): Rule {
  return (host: Tree) => {

    // add web-push dependency to package.json
    addDependencyToPackageJson(host, {
        type: NodeDependencyType.Default,
        name: 'web-push',
        version: '^3.2.5'
    });

    return host;
  };
}

function installPackageJsonDependencies(): Rule {
  return (host: Tree, context: SchematicContext) => {
    context.addTask(new NodePackageInstallTask());
    context.logger.log('info', `🔍 Installing packages...`);
    return host;
  };
}

function applyPackageJsonScripts(options: PWAOptions) {
	return (tree: Tree) => {
		const pkgPath = `/package.json`;
		const buffer = tree.read(pkgPath);
		if (buffer === null) {
			throw new SchematicsException('Could not find package.json');
		}
		const pkg = JSON.parse(buffer.toString());
        pkg.scripts['app-shell'] = `ng run ${options.project}:app-shell:production && npm run compiler:ssr && npm run serve:ssr`;
		tree.overwrite(pkgPath, JSON.stringify(pkg, null, 2));
		return tree;
	}
}

export function schematicsPWAWebPush(options: PWAOptions): Rule {
  return (host: Tree, context: FileSystemSchematicContext) => {
    const workspace = getWorkspace(host);
    const project = getProjectFromWorkspace(workspace, options.project);
    if (!project) {
      throw new SchematicsException(`Project is not defined in this workspace.`);
    }
    options.clientProject = options.project;

    if (options.path === undefined) {
      options.path = buildDefaultPath(project);
    }
    options.module = findModule(host, options.path, 'app' + MODULE_EXT, ROUTING_MODULE_EXT);
    
    options.name = '';
    const parsedPath = parseName(options.path!, options.name);
    options.name = parsedPath.name;
    options.path = parsedPath.path;

    return chain([
      branchAndMerge(chain([
        applyPackageJsonScripts(options),
        addPackageJsonDependencies(),
        applyWebPushOnServer(options),
        applyWebPushOnFront(options),
        addDeclarationToNgModule(options),
        installPackageJsonDependencies()
      ])),
    ])(host, context);
  };
}
