// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Widget } from '@lumino/widgets';
import { DocumentRegistry, DocumentWidget } from '@jupyterlab/docregistry';
import { GalyleoModel } from './index';
import { PLUGIN_ID } from './index';
// import { baseURL } from './constants';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { CodeEditor } from '@jupyterlab/codeeditor';

export class GalyleoDocument extends DocumentWidget<
  GalyleoEditor,
  GalyleoModel
> {}

// overwritten post-compile and pre-deploy.  DO NOT MODIFY IN THIS CODE!  See make.sh in the directory above
const debugMode = false;

export class GalyleoEditor extends Widget {
  private _iframe: HTMLIFrameElement;
  private _context: DocumentRegistry.IContext<GalyleoModel>;
  private _nullSave = (value: boolean) => {
    return;
  };
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _completeSave: Function = this._nullSave;
  private _settings: ISettingRegistry;

  constructor(options: GalyleoEditor.IOptions) {
    super();
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

  get model(): GalyleoModel {
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

  async _baseUrl(): Promise<string> {
    let galyleoSettings: ISettingRegistry.ISettings = <
      ISettingRegistry.ISettings
    >(<unknown>undefined);
    let languagePreference: ISettingRegistry.ISettings = <
      ISettingRegistry.ISettings
    >(<unknown>undefined);
    if (this._settings) {
      try {
        galyleoSettings = await this._settings.load(PLUGIN_ID);
      } catch (error) {
        galyleoSettings = <ISettingRegistry.ISettings>(<unknown>undefined);
      }

      languagePreference = await this._settings.load(
        '@jupyterlab/translation-extension:plugin'
      );
    }


    type languagePreferenceType = {
      en: string;
      ja_JP: string;
      'default': string
    };

    type modeType = {
      deploy: languagePreferenceType;
      beta: languagePreferenceType;
      debug: languagePreferenceType;
    };

    // Set up the defaults for language and mode

    const defaultPreference: keyof languagePreferenceType = 'en';

    // URLS by language and mode

    const defaultUrls: languagePreferenceType = {
      en: 'https://matt.engageLively.com/users/rick/published/studio-en/index.html?',
      ja_JP:
        'https://matt.engageLively.com/users/rick/published/studio-jp/index.html?',
      'default':
        'https://matt.engageLively.com/users/rick/published/studio-en/index.html?'
    };

    const urls: modeType = {
      deploy: defaultUrls,
      beta: defaultUrls,
      debug: defaultUrls
    };


    // Set up the defaults for language and mode

    let preference: keyof languagePreferenceType = 'en';
    let mode: keyof modeType = 'deploy';


    // read any set values

    if (galyleoSettings && debugMode) {
      if (galyleoSettings.get('mode').composite as string) {
        mode = galyleoSettings.get('mode').composite as keyof modeType;
      }
    }
    if (languagePreference) {
      preference = languagePreference.get('locale')
        .composite as keyof languagePreferenceType;
    } else {
      preference = defaultPreference;
    }
    return urls[mode][preference];
  }

  async _render(): Promise<void> {
    // now set the src accordingly on the iframe....?
    const filePath = this._context.path;
    const sessionId = this._context.model.session;
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
    this._iframe.src = `${baseURL}dashboard_file=${filePath}&session=${sessionId}&inJupyterLab=true&user=${user}`;
    // wait for session to load
  }

  setOption(key: string, value: any): void {
    // do nothingß
  }

  setOptions(options: Partial<CodeEditor.IConfig>): void {
    // do nothingß
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
    context: DocumentRegistry.IContext<GalyleoModel>;
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
