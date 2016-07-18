import * as I from 'immutable';

import { rationalMatrices } from '../arithmetic/types';
const ops = rationalMatrices;


const Edge = I.Record({
  head : undefined,
  tail : undefined,
  shift: undefined
});

Edge.prototype.toString = function toString() {
  return 'Edge('+this.head+', '+this.tail+', '+this.shift+')';
};

Edge.prototype.reverse = function reverse() {
  return new Edge({
    head : this.tail,
    tail : this.head,
    shift: this.shift.map(x => -x)
  });
};


const _isNegative = vec => vec.find(x => ops.sgn(x) != 0) < 0;


Edge.prototype.canonical = function canonical() {
  if (this.tail < this.head || (this.tail == this.head
                                && _isNegative(this.shift)))
    return this.reverse();
  else
    return this;
};

const _makeEdge = function _makeEdge(e) {
  return new Edge({ head: e[0], tail: e[1], shift: e[2] }).canonical();
};


const Graph = I.Record({
  dim  : undefined,
  edges: undefined
});

Graph.prototype.toString = function toString() {
  return 'PGraph('+this.edges+')';
};


export function make(data) {
  const edges = I.Set(data).map(_makeEdge);
  if (edges.size == 0)
    throw new Error('cannot be empty');

  const dim = edges.first().shift.length;
  if (edges.some(e => e.shift.length != dim))
    throw new Error('must have consistent shift dimensions');

  return new Graph({ dim: dim, edges: edges });
};


export function adjacencies(graph) {
  const target = e => ({ v: e.tail, s: e.shift });

  let res = I.Map();
  for (const e of graph.edges) {
    res = res
      .update(e.head, a => (a || I.List()).push(target(e)))
      .update(e.tail, a => (a || I.List()).push(target(e.reverse())));
  }
  return res;
};


export function coordinationSeq(graph, start, dist) {
  const adj  = adjacencies(graph);
  const zero = ops.vector(graph.dim);

  let oldShell = I.Set();
  let thisShell = I.Set([I.fromJS([start, zero])]);
  const res = [1];

  for (const i of I.Range(1, dist+1)) {
    let nextShell = I.Set().asMutable();
    for (const item of thisShell) {
      const [v, s] = item.toJS();
      for (const { v: w, s: t } of adj.get(v)) {
        const key = I.fromJS([w, ops.plus(s, t)]);
        if (!oldShell.contains(key) && !thisShell.contains(key))
          nextShell.add(key);
      }
    }

    res.push(nextShell.size);
    oldShell = thisShell;
    thisShell = nextShell;
  }

  return res;
};


const _componentInOrbitGraph = (graph, start) => {
  const adj = adjacencies(graph);
  const queue = [start]
  const bridges = [];
  const nodeShifts = I.Map([[start, ops.vector(graph.dim)]]).asMutable();

  while (queue.length) {
    const v = queue.shift();
    const av = nodeShifts.get(v);

    for (const {v: w, s: shift} of adj.get(v)) {
      if (nodeShifts.get(w) == undefined) {
        queue.push(w);
        nodeShifts.set(w, ops.minus(av, shift));
      }
      else {
        const aw = nodeShifts.get(w);
        const newShift = ops.plus(shift, ops.minus(aw, av));
        const pivot = newShift.find(x => ops.ne(x, 0));

        if (pivot != undefined && ops.gt(pivot, 0))
          bridges.push({ v, w, s: newShift });
      }
    }
  }

  return {
    nodes: I.Set(nodeShifts.keys()),
    nodeShifts,
    bridges
  };
};


const _isConnectedOrbitGraph = (graph) => {
  const verts = I.List(adjacencies(graph).keySeq());
  const comp = _componentInOrbitGraph(graph, verts.first());

  return comp.nodes.size >= verts.size;
};


const _basis = M => {
  const T = ops.triangulation(M).R;
  return T.slice(0, ops.rank(T));
};


const _componentInCoverGraph = (graph, start) => {
  const { nodes, nodeShifts, bridges } = _componentInOrbitGraph(graph, start);
  const basis = _basis(bridges.map(b => b.s));
  const transform = ops.inverse(basis);
  const old2new = I.Map(I.List(nodes).zip(I.Range(1, nodes.size+1)));

  const newEdges = graph.edges
    .filter(({ head, tail }) =>
            old2new.get(head) != null && old2new.get(tail) != null)
    .map(({ head, tail, shift }) => {
      const [v, w] = [old2new.get(head), old2new.get(tail)];
      const [av, aw] = [nodeShifts.get(head), nodeShifts.get(tail)];
      const t = ops.times(ops.plus(shift, ops.minus(aw, av)), transform);
      return [v, w, t];
    });

  return {
    basis,
    nodes: nodes.toArray(),
    multiplicity: ops.determinant(basis),
    graph: make(newEdges)
  };
};


export function isConnected(graph) {
  const verts = I.List(adjacencies(graph).keySeq());
  const comp = _componentInCoverGraph(graph, verts.first());

  return comp.nodes.length >= verts.size && comp.multiplicity == 1;
};


export function connectedComponents(graph) {
  const verts = I.List(adjacencies(graph).keySeq());
  const seen = I.Set().asMutable();
  const result = [];

  for (const start of verts) {
    if (!seen.contains(start)) {
      const comp = _componentInCoverGraph(graph, start);
      result.push(comp);
      comp.nodes.forEach(v => seen.add(v));
    }
  }

  return result;
};


export function barycentricPlacement(graph) {
  if (!isConnected(graph))
    throw new Error('must have a connected orbit graph');

  const adj   = adjacencies(graph);
  const verts = I.List(adj.keySeq());
  const vIdcs = I.Map(I.Range(0, verts.size).map(i => [verts.get(i), i]));

  const n = verts.size;
  const d = graph.dim;
  let A = ops.matrix(n+1, n);
  let t = ops.matrix(n+1, d);

  verts.forEach((v, i) => {
    adj.get(v).forEach(c => {
      if (c.v != v) {
        const j = vIdcs.get(c.v);
        A[i][j] -= 1;
        A[i][i] += 1;
        t[i] = ops.plus(t[i], c.s);
      }
    });
  });
  A[n][0] = 1;

  const p = ops.solve(A, t);

  return I.Map(I.Range(0, n).map(i => [verts.get(i), p[i]]));
};


export function barycentricPlacementAsFloat(graph) {
  return barycentricPlacement(graph).map(p => p.map(x => ops.toJS(x)));
};


export function isStable(graph, pos=barycentricPlacement(graph)) {
  const verts = I.List(adjacencies(graph).keySeq());
  const seen = I.Set().asMutable();

  for (const v of verts) {
    const p = pos.get(v);
    const key = I.fromJS(ops.repr(p.map(x => ops.mod(x, 1))));
    if (seen.contains(key))
      return false;
    else
      seen.add(key);
  }

  return true;
};


export function isLocallyStable(graph, pos=barycentricPlacement(graph)) {
  const adj = adjacencies(graph);
  const verts = I.List(adj.keySeq());

  for (const v of verts) {
    const seen = I.Set().asMutable();

    for (const w of adj.get(v)) {
      const p = ops.plus(pos.get(w.v), w.s);
      const key = I.fromJS(ops.repr(p));
      if (seen.contains(key))
        return false;
      else
        seen.add(key);
    }
  }

  return true;
};


const _neighborsByEdgeVector = (
  graph, v, adj=adjacencies(graph), pos=barycentricPlacement(graph)
) => {
  const result = I.Map().asMutable();

  for (const { v: w, s } of adj.get(v)) {
    const d = ops.plus(s, ops.minus(pos.get(w), pos.get(v)));
    result.set(I.fromJS(d), { v: w, s })
    if (v == w)
      result.set(I.fromJS(ops.negative(d)), { v, s: ops.negative(s) });
  }

  return result.asImmutable();
};


export function morphism(graph1, graph2, start1, start2, transform) {
  const errors = [];

  if (graph2.dim != graph1.dim)
    errors.push('graphs have different dimensions');
  if (!isLocallyStable(graph1))
    errors.push('first graph is not locally stable');
  if (!isLocallyStable(graph2))
    errors.push('second graph is not locally stable');
  if (!isConnected(graph1))
    errors.push('first graph is not connected');
  if (!isConnected(graph2))
    errors.push('second graph is not connected');
  if (transform != null && ops.dimensions(transform) != graph1.dim)
    errors.push('coordinate transformation has the wrong dimension');

  if (errors.length > 0)
    throw new Error(errors.join('\n'));

  const adj1 = adjacencies(graph1);
  const adj2 = adjacencies(graph2);
  const pos1 = barycentricPlacement(graph1);
  const pos2 = barycentricPlacement(graph2);

  const src2img = I.Map().asMutable();
  const img2src = I.Map().asMutable();
  const queue = [];

  src2img.set(start1, start2);
  img2src.set(start2, start1);
  queue.push(start1);

  while (queue.length) {
    const w1 = queue.shift();
    const w2 = src2img.get(w1);
    const n1 = _neighborsByEdgeVector(graph1, w1, adj1, pos1);
    const n2 = _neighborsByEdgeVector(graph2, w2, adj2, pos2);
  }
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const test = function test(g) {
    console.log('g = '+g);
    console.log('  cs  = '+coordinationSeq(g, 1, 10));
    if (isConnected(g)) {
      console.log('  pos = '+barycentricPlacement(g));
      console.log('      = '+barycentricPlacementAsFloat(g));
      console.log('  neighbors of 1: '
                  + JSON.stringify(_neighborsByEdgeVector(g, 1)));
      console.log('  stable: '+isStable(g));
      console.log('  locally stable: '+isLocallyStable(g));
    }

    for (const comp of connectedComponents(g)) {
      console.log('  component:');
      console.log('    nodes = '+comp.nodes);
      console.log('    graph = '+comp.graph);
      console.log('    basis = '+comp.basis);
      console.log('    multiplicity = '+comp.multiplicity);
    }
    console.log();
  };

  test(make([ [ 1, 1, [ 1, 0 ] ],
              [ 1, 1, [ 0, 1 ] ],
              [ 1, 2, [ 0, 0 ] ],
              [ 1, 2, [ 1, 1 ] ],
              [ 1, 3, [ 0, 0 ] ],
              [ 1, 3, [ 1, -1 ] ] ]));

  test(make([ [ 1, 1, [ 1, 0 ] ],
              [ 1, 1, [ 0, 1 ] ],
              [ 1, 2, [ 0, 0 ] ],
              [ 1, 2, [ 1, 1 ] ],
              [ 1, 3, [ 0, 0 ] ],
              [ 1, 3, [ 1, -1 ] ],
              [ 1, 4, [ 0, 0 ] ],
              [ 1, 4, [ 1, -1 ] ] ]));

  test(make([ [ 1, 1, [ -1,  1,  1 ] ],
              [ 1, 1, [  0, -1,  1 ] ],
              [ 1, 1, [  0,  0, -1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0 ] ],
              [ 1, 2, [ 1, 0 ] ],
              [ 1, 2, [ 0, 1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
              [ 1, 2, [ 1, 0, 0 ] ],
              [ 1, 2, [ 0, 1, 0 ] ],
              [ 1, 2, [ 0, 0, 1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
              [ 1, 2, [ 2, 0, 0 ] ],
              [ 1, 2, [ 0, 2, 0 ] ],
              [ 1, 2, [ 0, 0, 2 ] ] ]));

  test(make([ [ 1, 3, [ 0, 0, 0 ] ],
              [ 1, 3, [ 2, 0, 0 ] ],
              [ 1, 3, [ 0, 2, 0 ] ],
              [ 1, 3, [ 0, 0, 2 ] ],
              [ 2, 4, [ 0, 0, 0 ] ],
              [ 2, 4, [ 2, 0, 0 ] ],
              [ 2, 4, [ 0, 2, 0 ] ],
              [ 2, 4, [ 0, 0, 2 ] ] ]));
}
