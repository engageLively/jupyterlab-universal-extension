// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Widget } from '@lumino/widgets';
import {
  DocumentRegistry,
  DocumentWidget,
  DocumentModel
} from '@jupyterlab/docregistry';
// import { PLUGIN_ID } from './index';
// import { baseURL } from './constants';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { CodeEditor } from '@jupyterlab/codeeditor';

export class GalyleoDocument extends DocumentWidget<
  GalyleoEditor,
  DocumentModel
> {}

// overwritten post-compile and pre-deploy.  DO NOT MODIFY IN THIS CODE!  See make.sh in the directory above
// const debugMode = false;

export class GalyleoEditor extends Widget {
  private _iframe: HTMLIFrameElement;
  private _context: DocumentRegistry.IContext<DocumentModel>;
  private _nullSave = (value: boolean) => {
    return;
  };
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _completeSave: Function = this._nullSave;
  private _settings: ISettingRegistry;

  constructor(options: GalyleoEditor.IOptions) {
    super();
    console.log('Galyleo Editor constructed');
    this._context = options.context;
    this._settings = options.settings;
    this._iframe = document.createElement('iframe');
    this._iframe.style.cssText = 'width: 100%; height: 100%; border: 0px;';
    this.node.appendChild(this._iframe);
    this.node.onmouseleave = () => (this._iframe.style.pointerEvents = 'none');
    this.node.onmousemove = (evt: MouseEvent) => {
      if (document.getElementsByClassName('lm-Menu-content').length === 0) {
        this._iframe.style.pointerEvents = 'auto';
      }
    };

    void this._context.ready.then(async () => {
      await this._render();
    });
    this._context.pathChanged.connect(
      (context, path) => this.renamePath(path),
      this
    );
  }

  get model(): DocumentModel {
    return this._context.model;
  }

  onAfterShow(): void {
    // fix the labs in the scene that have been update while hidden
    this._iframe.contentWindow?.postMessage(
      { method: 'galyleo:fixLabels' },
      '*'
    );
  }

  get editor(): GalyleoEditor {
    return this;
  }

  completeSave(): void {
    if (this._completeSave !== this._nullSave) {
      this._completeSave(true);
    }
  }

  async requestSave(path: string): Promise<void> {
    this._iframe.contentWindow?.postMessage(
      { method: 'galyleo:save', path },
      '*'
    );
    await new Promise(resolve => (this._completeSave = resolve));
  }

  loadDashboard(jsonString: string): void {
    this._iframe.contentWindow?.postMessage(
      { method: 'galyleo:load', jsonString },
      '*'
    );
  }

  loadTable(table: any): void {
    // table is a dictionary, how do we say that?
    this._iframe.contentWindow?.postMessage(
      { method: 'galyleo:loadTable', table },
      '*'
    );
  }

  renamePath(path: string): void {
    this._iframe.contentWindow?.postMessage(
      { method: 'galyleo:rename', path },
      '*'
    );
  }

  // we are the receivers of the undo/redo commands

  undo(): void {
    this._iframe.contentWindow?.postMessage({ method: 'galyleo:undo' }, '*');
  }

  redo(): void {
    this._iframe.contentWindow?.postMessage({ method: 'galyleo:redo' }, '*');
  }

  _getHubLocation(): string {
    const location: string[] = document.location.href.split('/');
    if (location.length < 3) {
      return '';
    }
    const hostname: string = location[2].split(':')[0]; // strip off the port
    const hubname: string = hostname.split('.')[0]; // the hostname is the first entry
    return hubname;
  }

  async _baseUrl(): Promise<string> {
    let languagePreference: ISettingRegistry.ISettings = <
      ISettingRegistry.ISettings
    >(<unknown>undefined);
    if (this._settings) {
      languagePreference = await this._settings.load(
        '@jupyterlab/translation-extension:plugin'
      );
    }
    const host: string = this._getHubLocation();
    const preference = languagePreference.get('locale').composite
      ? languagePreference.get('locale').composite
      : undefined;

    const hubArgument: string = host.length > 0 ? `hub=${host}` : '';

    const languageArgument: string = preference ? `language=${preference}` : '';

    const base =
      'https://publication-server-htztskumkq-uw.a.run.app/get_studio_url';
    const tail =
      hubArgument.length > 0 && languageArgument.length > 0
        ? `?${hubArgument}&${languageArgument}`
        : hubArgument.length > 0
        ? `?${hubArgument}`
        : languageArgument.length > 0
        ? `?${languageArgument}`
        : '';
    const url = `${base}${tail}`;
    const response = await fetch(url);
    const responseURL = await response.text();
    return `${responseURL}?`;
  }

  async _render(): Promise<void> {
    // now set the src accordingly on the iframe....?
    const filePath = this._context.path;
    // const sessionId = this._context.model.session;
    // dig out the user from the URL; it will be the component of the path with an @ in it
    const parentUrl = window.location.href;
    const components = parentUrl.split('/');
    const userComponents = components.filter(comp => comp.indexOf('@') >= 0);
    const user = userComponents.length > 0 ? userComponents[0] : '';
    // assemble the url and load it into the iframe
    // const baseURL =
    //   'https://matt.engagelively.com/users/rick/published/Dashboard%20Studio%20Development/index.html?';
    // for debug:
    // const baseURL =
    //   'https://matt.engagelively.com/worlds/load?name=Dashboard%20Studio%20Development&';
    // both of these are defined in constants.ts, NOT versioned to avoid bogus changes and stashes.
    const baseURL = await this._baseUrl();
    // this._iframe.src = `${baseURL}dashboard_file=${filePath}&session=${sessionId}&inJupyterLab=true&user=${user}`;
    this._iframe.src = `${baseURL}dashboard_file=${filePath}&inJupyterLab=true&user=${user}`;
    // wait for session to load
  }

  setOption(key: string, value: any): void {
    // do nothing
  }

  setOptions(options: Partial<CodeEditor.IConfig>): void {
    // do nothing
  }

  getCursorPosition(): CodeEditor.IPosition {
    return {
      line: 0,
      column: 0
    };
  }

  getLine(lineNumber: number): string | null {
    return null;
  }

  get host(): HTMLElement {
    return this._iframe;
  }
}

/**
 * A namespace for TableOfContents statics.
 */
export namespace GalyleoEditor {
  /**
   * Interface describing table of contents widget options.
   */
  export interface IOptions {
    /**
     * Application document manager.
     */
    // docmanager: IDocumentManager;
    context: DocumentRegistry.IContext<DocumentModel>;
    settings: ISettingRegistry;

    /**
     * Notebook ref.
     */
    // notebook: INotebookTracker;

    // labShell: ILabShell;

    // app: JupyterFrontEnd;

    // browserModel: FileBrowserModel;
  }

  /**
   * Interface describing the current widget.
   */
  export interface ICurrentWidget<W extends Widget = Widget> {
    /**
     * Current widget.
     */
    widget: W;
  }
}
