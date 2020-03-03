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

* What is the logo url for the header menu? : < logo-url >
* Do you want to remove the content for app.component.html? : < Y/N >
* Do you want to integrate with the cap-authentication module?: < Y/N >
* Do you want to add cap-authentication Schematic? : < Y/N >
​
The Schematic will create a component for each feature of actions along with the routing configuration.

```
app
    |-- package.json
    |-- server.js
	|-- shared/
	    |-- web-push.service.ts
```

## Usage
angular 8

## Built With
[Schematic](https://www.schematics.com/)

## Version 
1.0

## Authors
Software Allies - [Software Allies](https://github.com/software-allies)
​
### Contributor 
César Alonso Magaña Gavilanes -[cesaralonso](https://github.com/cesaralonso)

## License
MIT © [Software Allies](https://github.com/software-allies/cap-angular-schematic-webpush)