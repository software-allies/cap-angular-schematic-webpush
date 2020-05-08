# cap-angular-schematic-webpush  [![NPM version](https://badge.fury.io/js/CAP.svg)](https://npmjs.org/package/CAP) [![Build Status](https://travis-ci.org/Elena%20M.%20Sarabia/CAP.svg?branch=master)](https://travis-ci.org/Elena%20M.%20Sarabia/CAP) [![Generic badge](https://img.shields.io/badge/CAP-Active-<COLOR>.svg)](https://shields.io/)
 This repository is a basic Schematic implementation that serves as a starting point to create and publish Schematics to NPM. 
 
# Getting Started
 These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

## Prerequisites
* Have an Angular app 
install  npm 6.13.7 
```	
nmp install 
```
* [Node](https://nodejs.org/en/download/current) 10.6 to the current. 


## Installation
To run the schematic, execute the following command.
```
ng add cap-angular-schematic-webpush 
```

The schematic will be configurated after you answer the following questions.

* What is the API Url for Web Push End Points? : < http://domain:port >
* What is the Vapid PublicKey? : < string >
* What is the Vapid PrivateKey?: < string >
​
The Schematic will do the next:
- Create a express server if not exist and ad the configuration and routes to use for add subscriptions and send notifictions to subscribers.
- Create a Angular service to send the subcription to the server and register on providers on app.module.ts.
- Add a example buttons to add the subscription event and for send notifications to subscribers.
- Add to app.component.ts the logic for update the service worker, subscribe to web push notifications and for execute the events of the example buttons for subscribe and send notifications to subscribers.
- Install web-push and if not exits a body-parser package.
- Add to environments the Vapid Public Key for Web Push.


Touched files:
```
app
    |-- package.json
    |-- server.js
    |-- app.component.ts
    |-- app.module.ts
    |-- environments/environment.ts
    |-- environments/environment.prod.ts
	|-- shared/
	    |-- web-push.service.ts
```

## How To show the Allow Notifications Dialog
If by accident we click "Deny" in the Allow Notifications dialog after hitting subscribe,
In order to trigger again the Allow Notifications popup, we need first to clear localhost from this list - [chrome://settings/content/notifications](chrome://settings/content/notifications)

## Generating VAPID keys
In order to generate a public/private VAPID key pair, we first need to install the [web-push](https://github.com/web-push-libs/web-push) library globally:

    npm install web-push -g

We can then generate a VAPID key pair with this command:

    web-push generate-vapid-keys --json

And here is a sample output of this command:

```
json
{
    "publicKey": "BF1BhDhSW89yKw6pWbLlzcDpCR3I3ViSCEiS_z0q_RP9-ablo5Up8HDIEP1-GauARtU7MxB6Yl_7FI8UvczPmaQ",
    "privateKey": "6XaIXj1cbSoaCpxSbOA-xYWHSISVSMCPUcSvEcczxkg"
}

```

## On Heroku
Once in the Heroku app the web-push package is installed, we must open the Heroku console and execute the next command:
"web-push generate-vapid-keys --json"

After that:
* On Heroku config app create Settings -> Config Vars "publicKey" and "privateKey".
* Replace the publickKey in te environments files of the Angular app and deploy again.



## Usage
angular 8

## Built With
[Schematic](https://www.schematics.com/)

## Version 
1.0.30

## Authors
Software Allies - [Software Allies](https://github.com/software-allies)
​
### Contributor 
César Alonso Magaña Gavilanes -[cesaralonso](https://github.com/cesaralonso)

## License
MIT © [Software Allies](https://github.com/software-allies/cap-angular-schematic-webpush)