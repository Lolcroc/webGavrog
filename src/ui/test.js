'use strict';

var I     = require('immutable');
var THREE = require('three');
var React = require('react');
var $     = React.DOM;

var R         = require('../arithmetic/float');
var M         = require('../arithmetic/matrix')(R, 0, 1);
var V         = require('../arithmetic/vector')(R, 0);
var delaney   = require('../dsymbols/delaney');
var tiling    = require('../dsymbols/tilings');
var periodic  = require('../pgraphs/periodic');

var Display3d = require('./Display3d');


var CoverVertex = I.Record({
  v: undefined,
  s: undefined
});

var graphPortion = function graphPortion(graph, start, dist) {
  var adj  = periodic.adjacencies(graph);

  var v0 = new CoverVertex({ v: start, s: V.constant(graph.dim) });
  var vertices = I.Map([[v0, 0]]);
  var edges = I.Set();
  var thisShell = I.List([v0]);

  I.Range(1, dist+1).forEach(function(i) {
    var nextShell = I.Set();
    thisShell.forEach(function(v) {
      var i = vertices.get(v);

      adj.get(v.v).forEach(function(t) {
        var w = new CoverVertex({ v: t.v, s: V.plus(v.s, V.make(t.s)) });

        if (vertices.get(w) == null) {
          vertices = vertices.set(w, vertices.size);
          nextShell = nextShell.add(w);
        }

        var j = vertices.get(w);

        if (!edges.contains(I.List([i, j])) && !edges.contains(I.List([j, i])))
          edges = edges.add(I.List([i, j]));
      });
    });

    thisShell = nextShell;
  });

  var verts = I.List();
  vertices.keySeq().forEach(function(v) {
    verts = verts.set(vertices.get(v), v);
  });

  return {
    vertices: verts,
    edges   : edges.map(function(e) { return e.toArray(); })
  };
};


var geometry = function geometry(vertices, faces) {
  var geom = new THREE.Geometry();

  vertices.forEach(function(v) {
    geom.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
  });

  faces.forEach(function(f) {
    f.forEach(function(v, i) {
      if (i > 0 && i+1 < f.length)
        geom.faces.push(new THREE.Face3(f[0], f[i], f[i+1]));
    });
  });

  geom.computeFaceNormals();
  return geom;
};


var stick = function stick(p, q, radius, segments) {
  var n = segments;
  var d = V.normalized(V.minus(q, p));
  var ex = V.make([1,0,0]);
  var ey = V.make([0,1,0]);
  var t = V.dotProduct(d, ex) > 0.9 ? ey : ex;
  var u = V.normalized(V.crossProduct(d, t));
  var v = V.normalized(V.crossProduct(d, u));
  var a = Math.PI * 2 / n;

  var section = I.Range(0, n).map(function(i) {
    var x = a * i;
    var c = Math.cos(x) * radius;
    var s = Math.sin(x) * radius;
    return V.plus(V.scaled(c, u), V.scaled(s, v));
  });

  return geometry(
    I.List().concat(section.map(function(c) { return V.plus(c, p); }),
                    section.map(function(c) { return V.plus(c, q); }))
      .map(function(v) { return v.data.toJS(); }),
    I.Range(0, n).map(function(i) {
      var j = (i + 1) % n;
      return [i, j, j+n, i+n];
    })
  );
};


var shrunk = function shrunk(f, vertices) {
  var n = vertices.size;
  var last = vertices.get(n-1);
  return I.List(vertices.take(n-1).map(function(v) {
    return V.plus(V.scaled(f, v), V.scaled(1-f, last));
  })).push(last);
};


var tetrahedra = function tetrahedron(vertexLists, material) {
  var extract = function(v) { return v.data.toJS(); };
  var model = new THREE.Object3D();

  vertexLists.forEach(function(vs) {
    var geom = geometry(vs.map(extract),
                        [[0,1,2],[1,0,3],[2,1,3],[0,2,3],
                         [0,2,1],[1,3,0],[2,3,1],[0,3,2]]);
    model.add(new THREE.Mesh(geom, material));
  });

  return model;
};


var ballAndStick = function ballAndStick(
  name, positions, edges, ballRadius, stickRadius, ballMaterial, stickMaterial)
{
  var model = new THREE.Object3D();
  var ball  = new THREE.SphereGeometry(ballRadius, 16, 8);

  positions.forEach(function(p) {
    var s = new THREE.Mesh(ball, ballMaterial);
    s.position.x = p[0];
    s.position.y = p[1];
    s.position.z = p[2];
    model.add(s);
  });

  edges.forEach(function(e) {
    var u = V.make(positions[e[0]]);
    var v = V.make(positions[e[1]]);
    var s = stick(u, v, stickRadius, 8);
    s.computeVertexNormals();
    model.add(new THREE.Mesh(s, stickMaterial));
  });

  return model;
};


var light = function(color, x, y, z) {
  var light = new THREE.PointLight(color);

  light.position.set(x, y, z);

  return light;
};


var apply = function(v, A) {
  return V.make(M.times(M.make([v.data]), A).data.first());
};


var makeScene = function(model, camera) {
  var scene  = new THREE.Scene();

  var ballMaterial = new THREE.MeshPhongMaterial({
    color    : 0xff0000,
    shininess: 50
  });

  var stickMaterial = new THREE.MeshPhongMaterial({
    color    : 0x0000ff,
    shininess: 50
  });

  var ds  = delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>');
  var t   = tiling(ds);
  var net = t.graph;
  var g   = graphPortion(net, 0, 3);
  var pos = t.positions;
  var verts = g.vertices.map(function(v) {
    var p = V.plus(pos.getIn([t.node2chamber.get(v.v), 0]), v.s);
    return apply(p, t.basis).data.toJS();
  }).toArray();
  if (delaney.dim(ds) == 2)
    verts = verts.map(function(p) {
      return [p[0], p[1], 0];
    });

  var model = ballAndStick(
    'cube',
    verts,
    g.edges,
    0.1,
    0.05,
    ballMaterial,
    stickMaterial
  );

  var chambers = tetrahedra(
    t.cover.elements().map(function(D) {
      return shrunk(0.8, pos.get(D).valueSeq().map(function(p) {
        return apply(p, t.basis);
      }));
    }),
    ballMaterial);

  var distance = 18;
  var camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10000);
  camera.name = 'camera';
  camera.position.z = 5*distance;

  camera.add(light(0xffffff,  3*distance,  5*distance, distance));
  camera.add(light(0x666666, -5*distance, -5*distance, distance));

  scene.add(model);
  scene.add(chambers);
  scene.add(camera);

  return scene;
};


var App = React.createClass({
  displayName: 'App',

  getInitialState: function() {
    var scene = makeScene();
    var camera = scene.getObjectByName('camera');
    return {
      scene: scene,
      camera: camera,
      cameraParameters: { distance: camera.position.z }
    };
  },

  handleResize: function(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  },

  componentDidMount: function() {
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  },

  componentWillUnmount: function() {
    window.removeEventListener('resize', this.handleResize);
  },

  render: function() {
    return $.div(
      null,
      React.createElement(Display3d, {
        scene           : this.state.scene,
        camera          : this.state.camera,
        cameraParameters: this.state.cameraParameters,
        width           : this.state.width - 20,
        height          : this.state.height - 20
      }));
  }
});


React.render(React.createElement(App), document.getElementById('react-main'));
