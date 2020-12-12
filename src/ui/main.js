import * as csp from 'plexus-csp';

import * as pickler from '../common/pickler';
import * as derived from '../dsymbols/derived';
import * as version from '../version';
import * as displayList from './displayList';
import * as makeScene from './makeScene';
import * as fileIO from './fileIO';

import parseDSymbols from '../io/ds';
import Worker from './sceneWorker';
import { Elm } from '../elm/GuiMain';
import { structures } from './builtinStructures';


const createWorker = () => {
  let lastId = 0;
  const callbacks = {};
  const worker = new Worker();

  worker.onmessage = event => {
    const { id, output, ok } = pickler.unpickle(event.data);

    ok ? callbacks[id](null, output) : callbacks[id](output);
    delete callbacks[id];
  };

  return (input, cb) => {
    const id = ++lastId;
    callbacks[id] = cb;
    worker.postMessage(pickler.pickle({ id, input }));
  };
};

const callWorker = csp.nbind(createWorker(), null);


const title = model => {
  if (model.structures && model.index != null) {
    const s = model.structures[model.index];
    const mod = (s.type == 'tiling') && model.options.tilingModifier;
    const ext = mod == 'dual' ? '-d' : mod == 't-analog' ? '-t' : '';
    const name = (s.name || 'unnamed') + ext;

    const fname = model.filename;
    const index = model.index + 1;
    const len = model.structures.length;
    const collection = fname ? `"${fname}"` : 'builtin';
    const groupName = model.data.sgInfo.groupName;
    return `#${index}/${len} - ${name} (${collection}) ${groupName}`;
  }
  else
    return '';
};


const gotoStructure = (config, model, i) => csp.go(function*() {
  const structures = model.structures;
  const n = structures.length;
  const index = i < 0 ? n + i % n : i % n;

  let newModel = model;

  try {
    if (structures[index].isRaw) {
      yield config.log('Converting structure data...');
      structures[index] = yield callWorker({
        cmd: 'processCGD',
        val: structures[index]
      });
    }

    const data = yield makeScene.preprocess(
      structures[index], model.options, callWorker, config.log
    );
    data.displayList = yield makeScene.makeDisplayList(
      data, model.options, callWorker, config.log
    );
    const scene = yield makeScene.makeScene(
      data, model.options, callWorker, config.log
    );

    newModel = Object.assign({}, model, { structures, index, data, scene });

    yield config.sendScene(scene, data.dim, true);
    yield config.sendTitle(title(newModel));
  }
  catch (ex) {
    console.error(ex);
    yield config.log(`ERROR processing structure ${index + 1}!!!`);

    newModel = Object.assign({}, model, { index });
  }

  return newModel;
});


const updateStructure = (config, model) => csp.go(function*() {
  try {
    const scene = yield makeScene.makeScene(
      model.data, model.options, callWorker, config.log
    );

    yield config.sendScene(scene, model.data.dim, false);
    return Object.assign({}, model, { scene } );
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR updating structure!!!`);
    return model;
  }
});


const updateDisplayList = (
  config, model, selected, update
) => csp.go(function*() {
  try {
    const selection = [];
    for (const { meshIndex, instanceIndex } of selected) {
      const instances = model.scene.instances.filter(
        inst => inst.meshIndex == meshIndex
      );
      selection.push(instances[instanceIndex]);
    }

    const displayList = update(model.data.displayList, selection);
    const data = Object.assign({}, model.data, { displayList });

    const scene = yield makeScene.makeScene(
      data, model.options, callWorker, config.log
    );

    yield config.sendScene(scene, model.data.dim, false);

    return Object.assign({}, model, { data, scene });
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR updating scene!!!`);
    return model;
  }
});


const freshDisplayList = (config, model, options) => csp.go(function*() {
  try {
    const displayList = yield makeScene.makeDisplayList(
      model.data, options, callWorker, config.log
    );

    const data = Object.assign({}, model.data, { displayList });
    const scene = yield makeScene.makeScene(
      data, model.options, callWorker, config.log
    );

    yield config.sendScene(scene, model.data.dim, false);

    const newOptions = Object.assign({}, model.options, options);
    return Object.assign({}, model, { data, scene, options: newOptions });
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR updating scene!!!`);
    return model;
  }
});


const newFile = (config, model, { file, data }) => csp.go(function*() {
  try {
    const filename = file.name;
    let structures = [];

    if (filename.match(/\.(ds|tgs)$/)) {
      yield config.log('Parsing .ds data...');
      structures = Array.from(parseDSymbols(data));
    }
    else if (filename.match(/\.(cgd|pgr)$/)) {
      yield config.log('Parsing .cgd data...');
      structures = yield callWorker({ cmd: 'parseCGD', val: data });
    }

    const newModel =
          Object.assign({}, model, { filename, structures, index: null });

    yield config.sendTitle(title(newModel));
    return yield gotoStructure(config, newModel, 0);
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR loading from file "${file.name}"!!!`);
  }
});


const dispatcher = (config, model, updateModel, setStructure) => {
  const action = {
    ['Open...']: () => config.loadFile(
      ({ file, data }) => updateModel(newFile(config, model, { file, data }))
    ),
    ['Save Structure...']: () => fileIO.saveStructure(config, model),
    ['Save Screenshot...']: (selected, options) =>
      fileIO.saveScreenshot(config, options),
    ['Save Scene As OBJ...']: () => fileIO.saveSceneOBJ(config, model),
    ['First']: () => setStructure(0),
    ['Prev']: () => setStructure(model.index - 1),
    ['Next']: () => setStructure(model.index + 1),
    ['Last']: () => setStructure(-1),
    ['Add Tile(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, displayList.addTiles
    )),
    ['Add Corona(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, displayList.addCoronas
    )),
    ['Restore Tile(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, displayList.restoreTiles
    )),
    ['Remove Tile(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, displayList.removeTiles
    )),
    ['Remove Tile Class(es)']: (selected) => updateModel(updateDisplayList(
      config, model, selected,
      displayList.removeTileClasses(model.data.tiles || [])
    )),
    ['Remove Element(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, displayList.removeElements
    )),
    ['Fresh Display List']: (_, options) => updateModel(freshDisplayList(
      config, model, options
    ))
  };

  return (text, ...args) => (action[text] || (() => {}))(...args);
};


const render = domNode => {
  const app = Elm.GuiMain.init({
    node: domNode,
    flags: { revision: version.gitRev, timestamp: version.gitDate }
  });

  const config = {
    loadFile: fileIO.fileLoader(),
    saveFile: fileIO.fileSaver(),
    log: text => app.ports.fromJS.send({ log: text }),
    sendTitle: text => app.ports.fromJS.send({ title: text }),
    sendScene: (scene, dim, reset) => {
      app.ports.fromJS.send({ scene, dim, reset })
    }
  };

  const model = { options: {}, structures };

  const updateModel = deferred => csp.go(function*() {
    Object.assign(model, yield deferred);
  });

  const setStructure = i => updateModel(gotoStructure(config, model, i));
  const dispatch = dispatcher(config, model, updateModel, setStructure);

  app.ports.toJS.subscribe(({ mode, text, options, selected }) => {
    if (mode == "jump") {
      const number = parseInt(text);
      if (!Number.isNaN(number))
        setStructure(number - (number > 0));
    }
    else if (mode == "search" && text) {
      const pattern = new RegExp(`^${text}$`, 'i');
      const i = model.structures.findIndex(s => !!pattern.exec(s.name));

      if (i >= 0)
        setStructure(i);
      else
        config.log(`Name "${text}" not found.`);
    }
    else if (mode == "action")
      dispatch(text, selected, options);
    else if (mode == "options") {
      const changedMod = (
        model.data.type == 'tiling' &&
          options.tilingModifier &&
          options.tilingModifier != model.options.tilingModifier
      );

      for (const key in options)
        model.options[key] = options[key];

      if (changedMod)
        setStructure(model.index);
      else
        updateModel(updateStructure(config, model));
    }
  });

  setStructure(0);
};


render(Document.body);
