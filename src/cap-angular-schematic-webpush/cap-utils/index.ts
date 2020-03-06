import { SchematicsException, Tree, UpdateRecorder } from '@angular-devkit/schematics';
import { getChildElementIndentation } from '@angular/cdk/schematics/utils/parse5-element';
import { DefaultTreeDocument, DefaultTreeElement, parse as parseHtml } from 'parse5';
import { getWorkspace } from '@schematics/angular/utility/config';
import { getFileContent } from '@schematics/angular/utility/test';
import { NodeDependency } from '@schematics/angular/utility/dependencies';
import * as ts from 'typescript';





export function createOrOverwriteFile(tree: Tree, filePath: string, fileContent: string): void {
    if (!tree.exists(filePath)) {
        tree.create(filePath, '');
    }
    tree.overwrite(filePath, fileContent);
}


/** Appends fragment the specified file. */
export function appendToStartFile(host: Tree, filePath: string, styleRule: string) {
    const fileBuffer = host.read(filePath);
    if (!fileBuffer) {
        throw new SchematicsException(`Could not read file for path: ${filePath}`);
    }
    const content = fileBuffer.toString();
    if (content.includes(styleRule)) {
        return;
    }
    const insertion = `${' '.repeat(0)}${styleRule}`;
    let recordedChange: UpdateRecorder;
    recordedChange = host
        .beginUpdate(filePath)
        .insertRight(0, `${insertion}\n`);
    host.commitUpdate(recordedChange);
}


/** Appends the given element HTML fragment to the specified HTML file. */
export function appendHtmlElementToTag(host: Tree, htmlFilePath: string, elementHtml: string, side: string = 'right') {
  const htmlFileBuffer = host.read(htmlFilePath);
  if (!htmlFileBuffer) {
    throw new SchematicsException(`Could not read file for path: ${htmlFilePath}`);
  }
  const htmlContent = htmlFileBuffer.toString();
  host.overwrite(`${htmlFilePath}`, (side === 'right') ? htmlContent + elementHtml : elementHtml + htmlContent);
}


/** Appends the given element HTML fragment to the `<body>` element of the specified HTML file. */
export function appendHtmlElementToBody(host: Tree, htmlFilePath: string, elementHtml: string, side: string = 'right') {
  const htmlFileBuffer = host.read(htmlFilePath);

  if (!htmlFileBuffer) {
    throw new SchematicsException(`Could not read file for path: ${htmlFilePath}`);
  }

  const htmlContent = htmlFileBuffer.toString();

  if (htmlContent.includes(elementHtml)) {
    return;
  }

  const bodyTag = getHtmlBodyTagElement(htmlContent);

  if (!bodyTag) {
    throw Error(`Could not find '<body>' element in HTML file: ${htmlFileBuffer}`);
  }

  // We always have access to the source code location here because the `getHtmlBodyTagElement`
  // function explicitly has the `sourceCodeLocationInfo` option enabled.
  const endTagOffset = bodyTag.sourceCodeLocation!.endTag.startOffset;
  const startTagOffset = bodyTag.sourceCodeLocation!.startTag.endOffset;
  const indentationOffset = getChildElementIndentation(bodyTag);
  const insertion = `${' '.repeat(indentationOffset)}${elementHtml}`;

  let recordedChange: UpdateRecorder;

    if (side === 'left') {
        recordedChange = host
            .beginUpdate(htmlFilePath)
            .insertLeft(startTagOffset, `${insertion}\n`);
        host.commitUpdate(recordedChange);
    } else if (side === 'right')  {
        recordedChange = host
            .beginUpdate(htmlFilePath)
            .insertRight(endTagOffset, `${insertion}\n`);
        host.commitUpdate(recordedChange);
    }
}



/** Adds a class to the body of the document. */
export function addBodyClass(host: Tree, htmlFilePath: string, className: string): void {
  const htmlFileBuffer = host.read(htmlFilePath);

  if (!htmlFileBuffer) {
    throw new SchematicsException(`Could not read file for path: ${htmlFilePath}`);
  }

  const htmlContent = htmlFileBuffer.toString();
  const body = getElementByTagName('body', htmlContent);

  if (!body) {
    throw Error(`Could not find <body> element in HTML file: ${htmlFileBuffer}`);
  }

  const classAttribute = body.attrs.find(attribute => attribute.name === 'class');

  if (classAttribute) {
    const hasClass = classAttribute.value.split(' ').map(part => part.trim()).includes(className);

    if (!hasClass) {
      const classAttributeLocation = body.sourceCodeLocation!.attrs.class;
      const recordedChange = host
        .beginUpdate(htmlFilePath)
        .insertRight(classAttributeLocation.endOffset - 1, ` ${className}`);
      host.commitUpdate(recordedChange);
    }
  } else {
    const recordedChange = host
      .beginUpdate(htmlFilePath)
      .insertRight(body.sourceCodeLocation!.startTag.endOffset - 1, ` class="${className}"`);
    host.commitUpdate(recordedChange);
  }
}

/** Parses the given HTML file and returns the body element if available. */
export function getHtmlBodyTagElement(htmlContent: string): DefaultTreeElement | null {
  return getElementByTagName('body', htmlContent);
}

/** Finds an element by its tag name. */
function getElementByTagName(tagName: string, htmlContent: string): DefaultTreeElement | null {  
  const document = parseHtml(htmlContent, {sourceCodeLocationInfo: true}) as DefaultTreeDocument;
  const nodeQueue = [...document.childNodes];

  while (nodeQueue.length) {
    const node = nodeQueue.shift() as DefaultTreeElement;
    
    if (node.nodeName.toLowerCase() === tagName) {
      return node;
    } else if (node.childNodes) {
      nodeQueue.push(...node.childNodes);
    }
  }

  return null;
}

export function fileExist(host: Tree, path: string): boolean {
  const text = host.read(path);
  if (text === null) {
    return false;
  }
  return true;
}

export function hasUniversalBuild(tree: Tree, options: any): boolean {
		let hasUniversalBuild = false;
		const workspace = getWorkspace(tree);
		const architect = workspace.projects[options.project].architect;
		if (architect) {
			for (let builder in architect) {
				if (architect[builder].builder === '@angular-devkit/build-angular:server') {
					hasUniversalBuild = true;
				}
			}
		}
		return hasUniversalBuild;
}


/***
 * NodeDependency example
 * type: NodeDependencyType.Default,
 * name: '@nguniversal/common',
 * version: '8.1.0'
*/
export function addDependencyToPackageJson(tree: Tree, dependency: NodeDependency): void {
    const packageJsonSource = JSON.parse(getFileContent(tree, `/package.json`));
    packageJsonSource[dependency.type][dependency.name] = dependency.version;
    tree.overwrite(`/package.json`, JSON.stringify(packageJsonSource, null, 2));
}

export function getSourceRoot(tree: Tree, options: any): string {
	const workspace = getWorkspace(tree);
	return `/${workspace.projects[options.project].sourceRoot}`;
}

export function readIntoSourceFile(host: Tree, modulePath: string) {
  const text = host.read(modulePath);
  if (text === null) {
    throw new SchematicsException(`File ${modulePath} does not exist.`);
  }
  return ts.createSourceFile(modulePath, text.toString('utf-8'), ts.ScriptTarget.Latest, true);
}

/**
 * Appends a key: value on a specific environment file 
 * @param host Tree
 * @param env The environment to be added (example: prod, staging...)
 * @param appPath application path (/src...)
 * @param key The key to be added
 * @param value The value to be added
 * @return void
*/
export function addEnvironmentVar(host: Tree, env: string, appPath: string, key: string, value: string): void {
  const environmentFilePath = `${appPath}/environments/environment${(env) ? '.' + env : ''}.ts`;
  const sourceFile = getFileContent(host, environmentFilePath);
  const keyValue = `
  ${key}: '${value}',`;
  host.overwrite(environmentFilePath, sourceFile.replace('export const environment = {', `export const environment = {${keyValue}` ));
}
