import * as I          from 'immutable';
import * as fw         from './freeWords';
import * as generators from '../common/generators';
import * as util       from '../common/util';

import partition from '../common/partition';


let _timers = null;


const mergeRows = (part, ra, rb) => {
  const row    = rb.merge(ra);
  const rowAlt = ra.merge(rb);

  const next = row
    .map((ag, g) => [ag, rowAlt.get(g)])
    .filter(([a, b]) => part.get(a) != part.get(b));

  return { row, next };
};


const identify = (table, part, a, b) => {
  const queue = [[a, b]];

  while (queue.length) {
    const [a, b] = queue.shift().map(part.get);

    if (a != b) {
      part = part.union(a, b);
      const { row, next } = mergeRows(part, table.get(a), table.get(b));
      table = table.set(a, row).set(b, row);
      next.forEach(x => queue.push(x));
    }
  }

  return { table, part };
};


const scan = function scan(table, w, start, from, to) {
  let row = start;
  let i = from;

  while (i < to) {
    const next = table.getIn([row, w.get(i)]);
    if (next === undefined)
      break;
    else {
      ++i;
      row = next;
    }
  }

  return {
    row  : row,
    index: i
  };
};


const scanAndIdentify = function scanAndIdentify(table, part, w, start) {
  _timers && _timers.start('scanAndIdentify()');

  const n = w.size;

  let t = scan(table, w, start, 0, n);
  const head = t.row;
  const i = t.index;

  t = scan(table, fw.inverse(w), start, 0, n - i);
  const tail = t.row;
  const j = n - t.index;

  let result;

  if (j == i+1)
    result =  {
      table: table.setIn([head, w.get(i)], tail).setIn([tail, -w.get(i)], head),
      part : part,
      next : head
    };
  else if (i == j && head != tail)
    result =  identify(table, part, head, tail);
  else
    result =  {
      table: table,
      part : part
    };

  _timers && _timers.stop('scanAndIdentify()');

  return result;
};


const scanRelations = function scanRelations(rels, subgens, table, part, start) {
  let current = {
    table: table,
    part : part
  };

  current = rels.reduce(
    (c, w) => scanAndIdentify(c.table, c.part, w, start),
    current
  );

  return subgens.reduce(
    (c, w) => scanAndIdentify(c.table, c.part, w, c.part.get(0)),
    current
  );
};


const compressed = function(table, part) {
  const toIdx = table
    .map((_, k) => k)
    .filter(k => part.get(k) == k)
    .toMap()
    .flip();

  const canon = a => toIdx.get(part.get(a));

  return table.toMap()
    .filter((r, k) => toIdx.get(k) != undefined)
    .mapKeys(canon)
    .map(row => row.map(canon));
};


const maybeCompressed = function(c, factor) {
  const invalid = c.table.filter(k => c.part.get(k) != k).size / c.table.size;
  if (invalid > factor)
    return { table: compressed(c.table, c.part), part: partition };
  else
    return c;
};


const withInverses = function(words) {
  return I.Set(words).merge(words.map(fw.inverse));
};


export function cosetTable(nrGens, relators, subgroupGens) {
  const gens = I.Range(1, nrGens+1).concat(I.Range(-1, -(nrGens+1)));
  const rels = withInverses(I.List(relators).map(fw.word).flatMap(
    r => I.Range(0, r.size).map(i => r.slice(i).concat(r.slice(0, i)))));
  const subgens = withInverses(subgroupGens.map(fw.word));

  let current = {
    table: I.List([I.Map()]),
    part : partition()
  };

  let i = 0, j = 0;

  while (true) {
    if (current.table.size > 10000)
      throw new Error('maximum coset table size reached');

    if (i >= current.table.size) {
      return compressed(current.table, current.part);
    } else if (j >= gens.size || i != current.part.get(i)) {
      ++i;
      j = 0;
    } else if (current.table.getIn([i, gens.get(j)]) !== undefined) {
      ++j;
    } else {
      const g = gens.get(j);
      const n = current.table.size;
      const table = current.table.setIn([i, g], n).setIn([n, -g], i);
      current = maybeCompressed(
        scanRelations(rels, subgens, table, current.part, n));
      ++j;
    }
  }
};


export function cosetRepresentatives(table) {
  let queue = I.List([0]);
  let reps = I.Map([[0, fw.empty]]);

  while (queue.size > 0) {
    const i = queue.first();
    const row = table.get(i);
    const free = row.filter(v => reps.get(v) === undefined);
    reps = reps.merge(free.entrySeq().map(
      e => [e[1], fw.product([reps.get(i), [e[0]]])]));
    queue = queue.shift().concat(free.toList());
  }

  return reps;
};


const _expandGenerators = function _expandGenerators(nrGens) {
  return I.Range(1, nrGens+1).concat(I.Range(-1, -(nrGens+1)));
};


const _expandRelators = function _expandRelators(relators) {
  return I.Set(I.List(relators).flatMap(fw.relatorPermutations));
};


const _freeInTable = function _freeInTable(table, gens) {
  return I.Range(0, table.size).flatMap(k => (
    gens
      .filter(g => table.get(k).get(g) == null)
      .map(g => ({ index: k, generator: g }))));
};


const _scanRecursively = function _scanRecursively(rels, table, index) {
  const q = [];
  const rs = rels.toArray();

  let row = index;
  let t   = table;
  let k   = 0;

  while (k < rs.length || q.length) {
    if (k < rs.length) {
      const rel = rs[k];
      ++k;
      const out = scanAndIdentify(t, partition(), rel, row);
      if (!out.part.isTrivial())
        return;

      t = out.table;
      if (out.next != null)
        q.push(out.next);
    } else {
      row = q.shift();
      k = 0;
    }
  }

  return t;
};


const _potentialChildren = function _potentialChildren(
  table, gens, rels, maxCosets
) {
  _timers && _timers.switchTo('generating candidates for extending the table');
  const free = _freeInTable(table, gens);

  if (!free.isEmpty()) {
    const k = free.first().index;
    const g = free.first().generator;
    const ginv = -g;
    const n = table.size;
    const matches = I.Range(k, n).filter(k => table.getIn([k, ginv]) == null);
    const candidates = n < maxCosets ? I.List(matches).push(n) : matches;

    _timers && _timers.switchTo('processing and filtering candidates');
    return candidates
      .map(function(pos) {
        const t = table.setIn([k, g], pos).setIn([pos, ginv], k);
        return _scanRecursively(rels, t, k);
      })
      .filter(t => t != null);
  }
  else
    return I.List();
};


const _compareRenumberedFom = function _compareRenumberedFom(table, gens, start) {
  let o2n = I.Map([[start, 0]]);
  let n2o = I.Map([[0, start]]);
  let row = 0;
  let col = 0;

  while (true) {
    if (row >= o2n.size && row < table.size)
      throw new Error("coset table is not transitive");

    if (row >= table.size)
      return 0;
    else if (col >= gens.size) {
      ++row;
      col = 0;
    } else {
      const oval = table.getIn([row, gens.get(col)]);
      let nval = table.getIn([n2o.get(row), gens.get(col)]);
      if (nval != null && o2n.get(nval) == null) {
        n2o = n2o.set(o2n.size, nval);
        o2n = o2n.set(nval, o2n.size);
      }
      nval = o2n.get(nval);

      if (oval == nval)
        ++col;
      else if (oval == null)
        return -1;
      else if (nval == null)
        return 1;
      else
        return nval - oval;
    }
  }
};


const _isCanonical = function _isCanonical(table, gens) {
  _timers && _timers.switchTo('checking for canonicity');
  return I.Range(1, table.size)
    .every(start => _compareRenumberedFom(table, gens, start) >= 0);
};


export function tables(nrGens, relators, maxCosets) {
  const gens = _expandGenerators(nrGens);
  const rels = _expandRelators(relators);
  const free = t => _freeInTable(t, gens);

  return generators.backtracker({
    root: I.List([I.Map()]),
    extract(table) { return free(table).isEmpty() ? table : undefined },
    children(table) {
      return _potentialChildren(table, gens, rels, maxCosets)
        .filter(t => !t.isEmpty() && _isCanonical(t, gens));
    }
  });
};


const _inducedTable = function _inducedTable(gens, img, img0) {
  const table = I.List([I.Map()]).asMutable();
  const o2n = I.Map([[img0, 0]]).asMutable();
  const n2o = I.Map([[0, img0]]).asMutable();
  let i = 0;

  while (i < table.size) {
    gens.forEach(function(g) {
      const k = img(n2o.get(i), g);
      const n = o2n.has(k) ? o2n.get(k) : table.size;
      o2n.set(k, n);
      n2o.set(n, k);
      table.setIn([i, g], n).setIn([n, -g], i);
    });
    ++i;
  }

  return table.asImmutable();
};


export function intersectionTable(tableA, tableB) {
  return _inducedTable(
    (tableA.first() || I.Map()).keySeq(),
    (es, g) => I.List([tableA.getIn([es.get(0), g]),
                       tableB.getIn([es.get(1), g])]),
    I.List([0, 0])
  );
};


export function coreTable(base) {
  return _inducedTable(
    (base.first() || I.Map()).keySeq(),
    (es, g) => es.map(e => base.getIn([e, g])),
    base.keySeq()
  );
};


const _sgn = x => (x > 0) - (x < 0);
const _sum = a => a.reduce((x, y) => x + y, 0);


export function relatorAsVector(rel, nrgens) {
  const counts = rel.groupBy(Math.abs).map(a => _sum(a.map(_sgn)));
  return I.List(I.Range(1, nrgens+1).map(i => counts.get(i) || 0));
};


export function relatorMatrix(nrgens, relators) {
  return relators.map(rel => relatorAsVector(rel, nrgens));
};


export function useTimers(timers) {
  _timers = timers;
}


if (require.main == module) {
  const timer = util.timer();

  const base = cosetTable(
    3,
    [[1,1], [2,2], [3,3], [1,2,1,2,1,2], [1,3,1,3], fw.raisedTo(3, [2,3])],
    [[1,2]]);

  let t = cosetRepresentatives(base);
  console.log(t.toList(), t.size);

  t = cosetRepresentatives(coreTable(base));
  console.log(t.toList(), t.size);

  console.log(_expandGenerators(4));
  console.log(_expandRelators([[1,2,-3]]));

  const tablesTimers = util.timers();
  useTimers(tablesTimers);

  generators.results(tables(2, [[1,1],[2,2],[1,2,1,2]], 8))
    .forEach(x => console.log(JSON.stringify(x)));
  console.log(`timing detail for coset table generation:`);
  console.log(`${JSON.stringify(tablesTimers.current(), null, 2)}`);

  console.log(`${timer()} msec total computation time`);
}
