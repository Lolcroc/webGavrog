import * as I from 'immutable';
import * as Q from '../arithmetic/number';
import _M from '../arithmetic/matrix';

const M = _M(Q, 0, 1);


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


const _sgn = x => (x > 0) - (x < 0);
const _isNegative = vec => vec.map(_sgn).find(x => x != 0) < 0;


Edge.prototype.canonical = function canonical() {
  if (this.tail < this.head || (this.tail == this.head
                                && _isNegative(this.shift)))
    return this.reverse();
  else
    return this;
};

const _makeEdge = function _makeEdge(e) {
  return new Edge({ head: e[0], tail: e[1], shift: I.List(e[2]) }).canonical();
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

  const dim = edges.first().shift.size;
  if (edges.some(e => e.shift.size != dim))
    throw new Error('must have consistent shift dimensions');

  return new Graph({ dim: dim, edges: edges });
};


const CoverVertex = I.Record({
  v: undefined,
  s: undefined
});


const _target = e => CoverVertex({ v: e.tail, s: e.shift });


export function adjacencies(graph) {
  let res = I.Map();

  graph.edges.forEach(function(e) {
    res = res
      .update(e.head, a => (a || I.List()).push(_target(e)))
      .update(e.tail, a => (a || I.List()).push(_target(e.reverse())));
  });

  return res;
};


export function coordinationSeq(graph, start, dist) {
  const adj  = adjacencies(graph);
  const zero = I.List(I.Repeat(0, graph.dim));
  const plus = (s, t) => I.Range(0, graph.dim).map(i => s.get(i) + t.get(i));

  let oldShell = I.Set();
  let thisShell = I.Set([CoverVertex({ v: start, s: zero })]);
  let res = I.List([1]);

  I.Range(1, dist+1).forEach(function(i) {
    let nextShell = I.Set();
    thisShell.forEach(function(v) {
      adj.get(v.v).forEach(function(t) {
        const w = CoverVertex({ v: t.v, s: plus(v.s, t.s) });
        if (!oldShell.contains(w) && !thisShell.contains(w))
          nextShell = nextShell.add(w);
      });
    });

    res = res.push(nextShell.size);
    oldShell = thisShell;
    thisShell = nextShell;
  });

  return res;
};


const _isConnectedOrbitGraph = function _isConnectedOrbitGraph(graph) {
  const adj   = adjacencies(graph);
  const verts = I.List(adj.keySeq());
  const start = verts.first();
  let seen  = I.Set([start]);
  let queue = I.List([start]);

  while (!queue.isEmpty()) {
    const v = queue.first();
    queue = queue.shift();
    adj.get(v).forEach(function(t) {
      const w = t.v;
      if (!seen.contains(w)) {
        seen = seen.add(w);
        queue = queue.push(w);
      }
    });
  }

  return verts.every(v => seen.contains(v));
};


const _inc = x => x+1;
const _dec = x => x-1;


const _addToRow = function _addToRow(A, i, vec) {
  vec.forEach((x, j) => { A = M.update(A, i, j, y => Q.plus(x, y)); });
  return A;
};

const _getRow = (A, i) => I.List(I.Range(0, A.ncols).map(j => M.get(A, i, j)));


export function barycentricPlacement(graph) {
  if (!_isConnectedOrbitGraph(graph))
    throw new Error('must have a connected orbit graph');

  const adj   = adjacencies(graph);
  const verts = I.List(adj.keySeq());
  const vIdcs = I.Map(I.Range(0, verts.size).map(i => [verts.get(i), i]));

  const n = verts.size;
  const d = graph.dim;
  let A = M.constant(n+1, n);
  let t = M.constant(n+1, d);

  verts.forEach(function(v, i) {
    adj.get(v).forEach(function(c) {
      if (c.v != v) {
        const j = vIdcs.get(c.v);
        A = M.update(A, i, j, _dec);
        A = M.update(A, i, i, _inc);
        t = _addToRow(t, i, c.s);
      }
    });
  });
  A = M.set(A, n, 0, 1);

  const p = M.solve(A, t);

  return I.Map(I.Range(0, n).map(i => [verts.get(i), _getRow(p, i)]));
};


export function barycentricPlacementAsFloat(graph) {
  return barycentricPlacement(graph).map(p => p.map(Q.toJS));
};


if (require.main == module) {
  const test = function test(g) {
    console.log('g = '+g);
    console.log('  cs  = '+coordinationSeq(g, 1, 10));
    console.log('  pos = '+barycentricPlacement(g));
    console.log('      = '+barycentricPlacementAsFloat(g));
    console.log();
  };

  test(make([ [ 1, 1, [ -1,  0,  0 ] ],
              [ 1, 1, [  0, -1,  0 ] ],
              [ 1, 1, [  0,  0, -1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0 ] ],
              [ 1, 2, [ 1, 0 ] ],
              [ 1, 2, [ 0, 1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
              [ 1, 2, [ 1, 0, 0 ] ],
              [ 1, 2, [ 0, 1, 0 ] ],
              [ 1, 2, [ 0, 0, 1 ] ] ]));
}
