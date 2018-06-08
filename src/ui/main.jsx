import * as React    from 'react';
import * as ReactDOM from 'react-dom';
import * as csp      from 'plexus-csp';

import * as webworkers from '../common/webworkers';
import * as version  from '../version';
import * as delaney  from '../dsymbols/delaney';
import parseDSymbols from '../io/ds';
import * as cgd      from '../io/cgd';

import Display3d     from './Display3d';
import Floatable     from './Floatable';
import makeScene     from './makeScene';
import Elm           from './ElmComponent'

import { TextInput } from '../elm/TextInput'
import { Options }   from '../elm/Options'
import { Menu }      from '../elm/Menu'
import { View3d }    from '../elm/View3d'


if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value(callback, type, quality) {
      const binStr = atob(this.toDataURL(type, quality).split(',')[1]);

      const len = binStr.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++ )
        arr[i] = binStr.charCodeAt(i);

      callback(new Blob([arr], { type: type || 'image/png' }));
    }
  });
}


const worker = webworkers.create('js/sceneWorker.js');
const callWorker = csp.nbind(worker, null);


const findName = data => (
  ((data.find(s => s.key == 'name') || {}).args || [])[0]);


const parseCgdBlock = text => {
  const block = cgd.blocks(text)[0];
  return { ...block, name: findName(block.content) };
};


const structures = [
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME bcu-net
  EDGES
      1   1     1 -1 -1
      1   1     1 -1  0
      1   1     1  0 -1
      1   1     1  0  0
END
    `),
  { name: 'bcu',
    type: 'tiling',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:4,4 2,6>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME pcu-net
  EDGES
      1   1     0  0  1
      1   1     0  1  0
      1   1     1  0  0
END
    `),
  { name: 'pcu',
    type: 'tiling',
    symbol: delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME nbo-net
  EDGES
      1   2     1 -1 -1
      1   2     1  0 -1
      1   3     1 -1 -1
      1   3     1 -1  0
      2   3    -1  0  1
      2   3     1 -1  0
END
    `),
  { name: 'nbo',
    type: 'tiling',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,4 2,4>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME dia-net
  EDGES
      1   2     0 -1  1
      1   2     0  0  0
      1   2     1 -1  0
      1   2     1  0  0
END
    `),
  { name: 'dia',
    type: 'tiling',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME srs
  EDGES
      1   2     0  0  0
      1   3     1 -1  0
      1   4    -1  0  0
      2   3     0  0  0
      2   4     0  0 -1
      3   4    -1  1  0
END
    `),
  { name: 'srs',
    type: 'tiling',
    symbol: delaney.parse(`
      <1.1:10 3:2 4 6 8 10,10 3 5 7 9,10 9 8 7 6,4 3 10 9 8:10,3 2 2 2 2 3,10>
      `)
  },
  parseCgdBlock(`
CRYSTAL
  NAME fau-net
  GROUP Fd-3m:2
  CELL 7.96625 7.96625 7.96625 90.0000 90.0000 90.0000
  NODE 1 4  0.03624 0.12500 0.44747
  EDGE  0.03624 0.12500 0.44747   0.12500 0.21376 0.44747
  EDGE  0.03624 0.12500 0.44747   0.12500 0.03624 0.44747
  EDGE  0.03624 0.12500 0.44747   -0.05253 0.12500 0.53624
  EDGE  0.03624 0.12500 0.44747   -0.03624 0.05253 0.37500
END
    `),
  { name: 'fau',
    type: 'tiling',
    symbol: delaney.parse(`
<1.1:24 3:1 3 4 5 6 8 9 10 11 12 13 15 16 17 18 19 20 21 22 23 24,
2 4 6 10 9 12 14 16 18 20 22 24,5 7 8 11 10 12 17 15 18 21 23 24,
13 14 15 16 19 20 8 10 24 23 21 22:4 4 12 6 4 6 4 6 6,3 3 3 3,3 3 3 3>
      `)
  },
  { name: 'hh01',
    type: 'tiling',
    symbol: delaney.parse(`<1.1:2:1 2,1 2,2:3 6,4>`)
  },
  { name: 'hh02',
    type: 'tiling',
    symbol: delaney.parse(`<2.1:2:1 2,1 2,2:4 4,4>`)
  },
  { name: 'hh03',
    type: 'tiling',
    symbol: delaney.parse(`<3.1:2:1 2,1 2,2:3 3,6>`)
  },
  { name: 'hh04',
    type: 'tiling',
    symbol: delaney.parse(`<4.1:4:1 2 3 4,1 2 4,3 4:3 6 4,4>`)
  },
  { name: 'hh05',
    type: 'tiling',
    symbol: delaney.parse(`<5.1:6:2 3 5 6,1 3 4 6,4 5 6:3 3,4 8>`)
  },
  { name: 'hh06',
    type: 'tiling',
    symbol: delaney.parse(`<6.1:6:2 3 5 6,1 2 3 4 6,4 5 6:4 3 3,12 4>`)
  },
  { name: 'hh07',
    type: 'tiling',
    symbol: delaney.parse(`<7.1:6:2 3 5 6,1 2 3 4 6,4 5 6:4 6 3,6 4>`)
  },
  { name: 'hh08',
    type: 'tiling',
    symbol: delaney.parse(`<8.1:6:2 3 5 6,1 2 3 4 6,4 5 6:12 3 3,4 4>`)
  },
  { name: 'hh09',
    type: 'tiling',
    symbol: delaney.parse(`<9.1:6:2 3 5 6,1 2 3 4 6,4 5 6:4 4 3,8 4>`)
  },
  { name: 'hh10',
    type: 'tiling',
    symbol: delaney.parse(`<10.1:6:2 3 5 6,1 2 3 4 6,4 5 6:8 4 3,4 4>`)
  },
  { name: 'hh11',
    type: 'tiling',
    symbol: delaney.parse(`<11.1:6:2 3 5 6,1 2 3 4 6,4 5 6:6 3 3,6 4>`)
  },
  { name: 'hh12',
    type: 'tiling',
    symbol: delaney.parse(`<12.1:8:1 3 4 5 7 8,1 2 4 6 8,5 6 7 8:3 3 4,4 6>`)
  },
  { name: 'hh13',
    type: 'tiling',
    symbol: delaney.parse(`
<13.1:8:1 3 4 5 7 8,1 2 3 4 6 8,5 6 7 8:3 4 6 4,4 4>
      `)
  },
  { name: 'hh14',
    type: 'tiling',
    symbol: delaney.parse(`
<14.1:10:2 4 5 7 9 10,1 5 4 6 8 10,6 7 8 9 10:3 4 5,4 4>
      `)
  },
  { name: 'hh15',
    type: 'tiling',
    symbol: delaney.parse(`
<15.1:10:2 4 5 7 9 10,1 5 4 6 8 10,6 7 8 9 10:3 3 5,6 4>
                            `)
  },
  { name: 'hh16',
    type: 'tiling',
    symbol: delaney.parse(`
<16.1:10:2 4 5 7 9 10,1 2 3 5 6 8 10,6 7 8 9 10:4 3 5,4 4 4>
      `)
  },
  { name: 'hh17',
    type: 'tiling',
    symbol: delaney.parse(`
<17.1:12:2 4 6 8 10 12,6 3 5 12 9 11,7 8 9 10 11 12:3 3,4 6 12>
      `)
  },
  { name: 'hh18',
    type: 'tiling',
    symbol: delaney.parse(`
<18.1:12:2 4 6 8 10 12,1 2 3 5 6 12 9 11,7 8 9 10 11 12:4 4 3,8 4 4>
                            `)
  },
  { name: 'hh19',
    type: 'tiling',
    symbol: delaney.parse(`
<19.1:12:2 4 6 8 10 12,1 2 3 4 5 6 12 9 11,7 8 9 10 11 12:4 6 12 3,4 4 4>
      `)
  },
  { name: 'hh20',
    type: 'tiling',
    symbol: delaney.parse(`
<20.1:16:2 4 6 8 10 12 14 16,2 8 5 7 16 11 13 15,9 10 11 12 13 14 15 16:
3 3 4,4 4 12>
                            `)
  },
  { name: 'hh21',
    type: 'tiling',
    symbol: delaney.parse(`
<21.1:16:2 4 6 8 10 12 14 16,2 8 5 7 16 11 13 15,9 10 11 12 13 14 15 16:
6 3 4,4 4 6>
      `)
  },
  { name: 'hh22',
    type: 'tiling',
    symbol: delaney.parse(`
<22.1:16:2 4 6 8 10 12 14 16,2 8 5 7 16 11 13 15,9 10 11 12 13 14 15 16:
4 3 4,4 4 8>
      `)
  },
  { name: 'hh23',
    type: 'tiling',
    symbol: delaney.parse(`
<23.1:20:2 4 6 8 10 12 14 16 18 20,2 10 5 9 8 20 13 15 17 19,
11 12 13 14 15 16 17 18 19 20:3 3 6 5,4 4 4>
                            `)
  },
];


class FileLoader {
  constructor(onData, accept, multiple=false, binary=false) {
    this.onData = onData;
    this.accept = accept;
    this.multiple = multiple;
    this.binary = binary;
  }

  _getInputElement() {
    if (!this.input) {
      this.input = document.createElement('input');

      this.input.type = 'file';
      this.input.accept = this.accept;
      this.input.multiple = this.multiple;
      this.input.addEventListener('change', event => this._loadFile(event));
    }

    return this.input;
  }

  _loadFile(event) {
    const onData = this.onData;
    const files = event.target.files;

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = event => onData(file, event.target.result);

      if (this.binary)
        reader.readAsDataURL(file);
      else
        reader.readAsText(file);
    }
  }

  select() {
    this._getInputElement().click();
  }

  destroy() {
    if (this.input)
      document.body.removeChild(this.input);
    this.input = null;
  }
}


class FileSaver {
  constructor() {
  }

  _getDownloadLink() {
    if (!this.link) {
      this.link = document.createElement('a');
      this.link.style.display = 'none';
      document.body.appendChild(this.link);
    }
    return this.link;
  }

  save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = this._getDownloadLink();

    link.download = filename;
    link.href = url;
    link.click();
  }

  destroy() {
    if (this.link)
      document.body.removeChild(this.link);
    this.link = null;
  }
}


const defaultOptions = {
  colorByTranslationClass: false,
  skipRelaxation: false,
  extraSmooth: false,
  showSurfaceMesh: false,
  highlightPicked: false
};


const optionLabel = {
  colorByTranslationClass: "Color By Translations",
  skipRelaxation: "Skip Relaxation",
  extraSmooth: "Extra-Smooth Faces",
  showSurfaceMesh: "Show Surface Mesh",
  highlightPicked: "Highlight On Mouseover"
};


class App extends React.Component {
  constructor() {
    super();
    this.state = { windowsActive: {}, options: defaultOptions };
    this.loader = new FileLoader(this.handleFileData.bind(this));
    this.saver = new FileSaver();
  }

  componentDidMount() {
    this.handleResize();
    this.resizeListener = data => this.handleResize(data);
    window.addEventListener('resize', this.resizeListener);

    this.setStructure(0, structures);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeListener);
  }

  handleResize(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  log(s) {
    this.setState({ log: s });
  }

  title(fname, index, len, name) {
    const prefix = fname ? `File "${fname}" ` : 'Structure ';
    const postfix = name ? `: ${name}` : '';
    this.setState({ title: `${prefix}#${index} (of ${len})${postfix}` });
  }

  setStructure(i, structures) {
    structures = structures || this.state.structures;
    const n = structures.length;
    const index = i < 0 ? n + i % n : i % n;

    this.setState({ structures, index });

    this.title(
      this.state.filename,
      index + 1,
      structures.length,
      structures[index].name);

    csp.go(function*() {
      try {
        if (structures[index].isRaw) {
          this.log('Converting structure data...');
          structures[index] = yield callWorker({
            cmd: 'processCGD',
            val: structures[index]
          });
        }

        const scene = yield makeScene(
          structures[index],
          this.state.options,
          callWorker,
          s => this.log(s));

        const camera = scene.getObjectByName('camera');
        const cameraParameters = { distance: camera.position.z };

        this.setState({ structures, index, scene, camera, cameraParameters });
      } catch(ex) {
        this.log('ERROR processing the structure!!!');
        console.error(ex);
      }
    }.bind(this));
  }

  handleFileData(file, data) {
    const filename = file.name;
    this.setState({ filename });

    csp.go(function*() {
      let list = [];

      if (filename.match(/\.(ds|tgs)$/))
        list = Array.from(parseDSymbols(data));
      else if (filename.match(/\.(cgd|pgr)$/)) {
        this.log('Parsing .cgd data...');
        list = yield callWorker({ cmd: 'parseCGD', val: data });
      }

      this.setStructure(0, list);
    }.bind(this));
  }

  saveStructure() {
    const structure = this.state.structures[this.state.index];

    if (structure.type == 'tiling') {
      const text = structure.symbol.toString();
      const blob = new Blob([text], { type: 'text/plain' });
      this.saver.save(blob, 'gavrog.ds');
    }
    else
      throw new Error(`save not yet implemented for '${structure.type}'`);
  }

  saveScreenshot() {
    const canvas = document.getElementById('main-3d-canvas');

    if (canvas)
      canvas.toBlob(blob => this.saver.save(blob, 'gavrog.png'));
    else
      this.log('ERROR: could not save screenshot - no canvas element found');
  }

  showWindow(key) {
    this.setState((state, props) => ({
      windowsActive: { ...state.windowsActive, [key]: true }
    }));
  }

  hideWindow(key) {
    this.setState((state, props) => ({
      windowsActive: { ...state.windowsActive, [key]: false }
    }));
  }

  render3dScene() {
    return (
      <Elm src={View3d} />
    );
  }

  mainMenu() {
    const fileMenu = [
      { label: 'Open...', action: () => this.loader.select() },
      { label: 'Save Structure...', action: () => this.saveStructure() },
      { label: 'Save Screenshot...', action: () => this.saveScreenshot() }
    ];

    const structureMenu = [
      { label: 'First', action: () => this.setStructure(0) },
      { label: 'Prev', action: () => this.setStructure(this.state.index - 1) },
      { label: 'Next', action: () => this.setStructure(this.state.index + 1) },
      { label: 'Last', action: () => this.setStructure(-1) },
      { label: 'Jump...', action: () => this.showWindow('jump') },
      { label: 'Search...', action: () => this.showWindow('search') }
    ];

    const viewMenu = [
      { label: 'Center', action: () => this.display.center() },
      { label: 'Along X', action: () => this.display.viewAlongX() },
      { label: 'Along Y', action: () => this.display.viewAlongY() },
      { label: 'Along Z', action: () => this.display.viewAlongZ() }
    ];

    const helpMenu = [
      { label: 'About Gavrog...', action: () => this.showWindow('about') }
    ];

    return [
      { label: 'File',   submenu: fileMenu },
      { label: 'Structure', submenu: structureMenu },
      //{ label: 'View',   submenu: viewMenu },
      { label: 'Options...', action: () => this.showWindow('options') },
      { label: 'Help',   submenu: helpMenu }
    ];
  }

  renderMenu() {
      const stripSubmenu = menu => menu.map(({ label }) => label);

      const stripMenu = menu => menu.map(({ label, submenu }) =>
          ({ label, submenu: submenu ? stripSubmenu(submenu) : null }));

      const mapMenu = menu => menu.map(({ action, submenu }) =>
          submenu ? mapMenu(submenu) : action);

      const toAction = mapMenu(this.mainMenu());

      const handler = ([i, j]) => {
          if (i != null) {
              const a = toAction[i];
              if (typeof a == 'function')
                  a();
              else if (j != null) {
                  const b = a[j];
                  if (typeof b == 'function')
                      b();
              }
          }
      };

      return (
          <Elm src={Menu}
               flags={{
                   classes: {
                       menu: "infoBoxMenu",
                       item: "infoBoxMenuItem",
                       submenu: "infoBoxMenuSubmenu",
                       subitem: "infoBoxMenuSubmenuItem",
                       highlight: "infoBoxMenuHighlight"
                   },
                   items: stripMenu(this.mainMenu())
               }}
               ports={ ports => ports.send.subscribe(handler) } />
      );
  }

  renderMainDialog() {
      return (
          <Floatable className="infoBox">
              <img width="48" className="infoBoxLogo" src="3dt.ico"/>
              <h3 className="infoBoxHeader">Gavrog</h3>
              <span className="clearFix">
                  {this.state.title}<br/>
                  {this.state.log || "Welcome!"}
              </span>
              {this.renderMenu()}
          </Floatable>
      );
  }

  renderAboutDialog() {
    if (!this.state.windowsActive.about)
      return;

    return (
      <Floatable className="infoBox"
                 fixed={true}
                 x="c"
                 y="c"
                 onClick={() => this.hideWindow('about')}>
        <img width="48" className="infoBoxLogo" src="3dt.ico"/>
        <h3 className="infoBoxHeader">Gavrog for Web</h3>
        <span className="clearFix">
          by Olaf Delgado-Friedrichs 2017<br/>
          The Australian National University
        </span>
        <p>
          <b>Version:</b> 0.0.0 (pre-alpha)<br/>
          <b>Revision:</b> {version.gitRev}<br/>
          <b>Timestamp:</b> {version.gitDate}
        </p>
      </Floatable>
    );
  }

  handleJumpSubmit(text) {
    this.hideWindow('jump');

    const number = parseInt(text);

    if (!Number.isNaN(number))
      this.setStructure(number - (number > 0));
  }

  renderJumpDialog() {
    if (!this.state.windowsActive.jump)
      return;

    const handler = text => this.handleJumpSubmit(text);

    return (
      <Floatable className="infoBox" x="c" y="c">
        <Elm src={TextInput}
             flags={{ label: 'Jump to', placeholder: 'Number' }}
             ports={ ports => ports.send.subscribe(handler) } />
      </Floatable>
    );
  }

  handleSearchSubmit(text) {
    this.hideWindow('search');

    if (text) {
      const pattern = new RegExp(`\\b${text}\\b`, 'i');

      csp.go(function*() {
        const i = this.state.structures.findIndex(s => !!pattern.exec(s.name));
        if (i >= 0)
          this.setStructure(i);
        else
          this.log(`Name "${text}" not found.`);
      }.bind(this));
    }
  }

  renderSearchDialog() {
    if (!this.state.windowsActive.search)
      return;

    const handler = text => this.handleSearchSubmit(text);

    return (
      <Floatable className="infoBox" x="c" y="c">
        <Elm src={TextInput}
             flags={{ label: 'Search by name', placeholder: 'Regex' }}
             ports={ ports => ports.send.subscribe(handler) } />
      </Floatable>
    );
  }

  handleOptionsSubmit(data, value) {
    this.hideWindow('options');

    if (value) {
      const options = {};
      for (const { key, value } of data)
        options[key] = value;

      this.setState((state, props) => ({ options }));
      this.setStructure(this.state.index);
    }
  }

  renderOptionsDialog() {
    if (!this.state.windowsActive.options)
      return;

    const handler = ([data, value]) => this.handleOptionsSubmit(data, value);
    const options = this.state.options;
    const flags = Object.keys(options).map(key => ({
      key: key,
      label: optionLabel[key],
      value: options[key]
    }));

    return (
      <Floatable className="infoBox" x="c" y="c">
        <Elm src={Options}
             flags={flags}
             ports={ports => ports.send.subscribe(handler)} />
      </Floatable>
    );
  }

  render() {
    const message = this.state.log || "Welcome!";

    return (
      <div>
        {this.render3dScene()}
        {this.renderMainDialog()}
        {this.renderAboutDialog()}
        {this.renderJumpDialog()}
        {this.renderSearchDialog()}
        {this.renderOptionsDialog()}
      </div>
    );
  }
}


ReactDOM.render(<App/>, document.getElementById('react-main'));
