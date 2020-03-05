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
  SchematicContext,
  noop
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
  readIntoSourceFile,
  addEnvironmentVar
} from './cap-utils';
import {
  addProviderToModule,
  addImportToModule
 } from './vendored-ast-utils';
import { Schema as PWAOptions } from './schema';
import { getAppName } from './cap-utils/package';



function createPushService(tree: Tree, options: PWAOptions) {

  const pushServiceContent = 
  `
import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { map, catchError, tap } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';


@Injectable({
    providedIn: 'root'
})
export class PushService {
    private actionUrl: string;
    private httpOptions: any;

    constructor(private http: HttpClient) {
        this.httpOptions = {
            headers: new HttpHeaders({
                'Content-Type': 'application/json'
            })
        };

        this.actionUrl = '${options.domain}';
    }

    addPushSubscriber(sub: any): Observable<any> {
        return this.http.post<HttpResponse<any>>(this.actionUrl + '/api/add-push-subscriber', JSON.stringify(sub), this.httpOptions)
        .pipe(
            map(response => response),
            tap((response: HttpResponse<any>) => {
                return response;
            }),
            catchError(error => this.handleError(error))
        );
    }

    send() {
        return this.http.post(this.actionUrl + '/api/send-push-notifications', null, this.httpOptions);
    }

    private handleError(error: any) {
        console.log(error);
        return throwError(error || 'Server error');
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
import { environment } from './../environments/environment';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

    title = '${options.project}';
    sub: any;

    readonly VAPID_PUBLIC_KEY = environment.vapidKeysPublicKey;

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

function addToEnvironments(options: PWAOptions): Rule {
    return (host: Tree) => {
        addEnvironmentVar(host, '', 'vapidKeysPublicKey', options.vapidPublicKey);
        addEnvironmentVar(host, 'prod', 'vapidKeysPublicKey', options.vapidPublicKey);
    }
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

function createExpressServer(options: PWAOptions): Rule {
    return (tree: Tree) => {

        const expressServer = `
const express = require('express');
const join = require('path').join;
const PORT = ${options.domain.split(':')[2] || 4000};

// Express server
const app = express();

// Serve static files....
app.use(express.static(__dirname + '/dist/${options.project}'));

// Send all requests to index.html
app.get('/*', function(req, res) {
  res.sendFile(path.join(__dirname + '/dist/${options.project}/index.html'));
});

// Start up the Node server
app.listen(PORT, () => {
    console.log('Node server listening on port: ' + PORT);
});
        `;

        createOrOverwriteFile(tree, 'server.js', expressServer);
    }
}

function applyWebPushOnServer(options: PWAOptions): Rule {
    return (tree: Tree) => {

        const bodyParser = `
const bodyParser = require('body-parser');
app.use(bodyParser.json());
`;

        const filePath = options.serverPath || '/server.js';
        const appComponent = getFileContent(tree, filePath);

        // Search if is using body-parser
        options.haveBodyParser = (appComponent.indexOf(`bodyParser.json()`) > -1) ? true : false;

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

// Web-Push Block
const webpush = require('web-push');
${(options.haveBodyParser) ? '' : bodyParser}

const vapidKeys = {
    "publicKey": process.env['publicKey'] || "${options.vapidPublicKey}",
    "privateKey": process.env['privateKey'] || "${options.vapidPrivateKey}"
};

webpush.setVapidDetails(
    'mailto:example@yourdomain.org',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

let USER_SUBSCRIPTIONS = [];

function addPushSubscriber(req, res) {
    const sub = req.body;
    console.log('Received Subscription on the server: ', sub);
    USER_SUBSCRIPTIONS.push(sub);
    res.status(200)
        .json({ message: "Subscription added successfully." });
}

function sendPushNotifications(req, res) {

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

// Web-Push REST API
app.route('/api/add-push-subscriber')
    .post(addPushSubscriber);

app.route('/api/send-push-notifications')
    .post(sendPushNotifications);

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    );
    return next();
});

`;

        createOrOverwriteFile(tree, filePath, appComponent.replace(`app = express();`, `app = express();` + addToServer));
    }
}

function addPackageJsonDependencies(options: PWAOptions): Rule {
  return (host: Tree) => {

    // add web-push dependency to package.json
    addDependencyToPackageJson(host, {
        type: NodeDependencyType.Default,
        name: 'web-push',
        version: '^3.2.5'
    });

    if (!options.haveBodyParser) {
        // add body-parser dependency to package.json
        addDependencyToPackageJson(host, {
            type: NodeDependencyType.Dev,
            name: 'body-parser',
            version: '^1.19.0'
        });
    }

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
        pkg.scripts['app-shell'] = `ng run ${options.project}:app-shell:production`;
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

    // Get project
    options.project = getAppName(host);
    if (!options.project) {
      throw new SchematicsException('Option "project" is required.');
    }

    if (options.path === undefined) {
      options.path = buildDefaultPath(project);
    }
    options.module = findModule(host, options.path, 'app' + MODULE_EXT, ROUTING_MODULE_EXT);
    
    options.name = '';
    const parsedPath = parseName(options.path!, options.name);
    options.name = parsedPath.name;
    options.path = parsedPath.path;

    // Search server
    let haveServer = false;	
    const bufferServerTs = host.read(`/server.ts`);
    const bufferServerJs = host.read(`/server.js`);
    if (bufferServerTs !== null) {
        haveServer = true;
        options.serverPath = '/server.ts';
    }
    if (bufferServerJs !== null) {
        haveServer = true;
        options.serverPath = '/server.js';
    }

    return chain([
      branchAndMerge(chain([
        (!haveServer) ? createExpressServer(options) : noop(),
        applyWebPushOnServer(options),
        applyPackageJsonScripts(options),
        addPackageJsonDependencies(options),
        applyWebPushOnFront(options),
        addDeclarationToNgModule(options),
        addToEnvironments(options),
        installPackageJsonDependencies()
      ])),
    ])(host, context);
  };
}


