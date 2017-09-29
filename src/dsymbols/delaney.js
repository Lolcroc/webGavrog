import * as I from 'immutable';


const _get = (ds, list, i, D) => list[i * ds.size + D - 1];


class DSymbol {
  constructor(dim, sData, vData) {
    this._s = sData.slice();
    this._v = vData.slice();
    this._dim = dim;
    this._size = this._v.length / dim;
  }

  get dim() {
    return this._dim;
  }

  get size() {
    return this._size;
  }

  isElement(D) {
    return Number.isInteger(D) && D >= 1 && D <= this.size;
  }

  elements() {
    return I.Range(1, this.size + 1);
  }

  isIndex(i) {
    return Number.isInteger(i) && i >= 0 && i <= this.dim;
  }

  indices() {
    return I.Range(0, this.dim + 1);
  }

  s(i, D) {
    if (this.isElement(D) && this.isIndex(i))
      return _get(this, this._s, i, D);
  }

  v(i, j, D) {
    if (this.isElement(D) && this.isIndex(i) && this.isIndex(j)) {
      if (j == i+1)
        return _get(this, this._v, i, D);
      else if (j == i-1)
        return _get(this, this._v, j, D);
      else if (this.s(i, D) == this.s(j, D))
        return 2;
      else
        return 1;
    }
  }

  toString() {
    return stringify(this);
  }

  toJSON() {
    return stringify(this);
  }
};


const _dsymbol = (dim, s, v) => Object.freeze(new DSymbol(dim, s, v));


const _assert = (condition, message) => {
  if (!condition)
    throw new Error(message || 'assertion error');
};


export const withPairings = (ds, i, specs) => {
  _assert(ds.isIndex(i), `need integer between 0 and ${ds.dim}, got ${i}`);

  const sNew = ds._s.slice();
  const get = D => sNew[i * ds.size + D - 1];
  const set = (D, x) => { sNew[i * ds.size + D - 1] = x; };

  const dangling = [];

  for (const [D, E] of specs) {
    _assert(ds.isElement(D), `need integer between 1 and ${ds.size}, got ${D}`);
    _assert(ds.isElement(E), `need integer between 1 and ${ds.size}, got ${E}`);

    dangling.push(get(D));
    dangling.push(get(E));

    set(D, E);
    set(E, D);
  }

  for (const D of dangling) {
    if (D && get(get(D)) != D)
      set(D, 0);
  }

  return _dsymbol(ds.dim, sNew, ds._v);
};


export const withBranchings = (ds, i, specs) => {
  _assert(ds.isIndex(i), `need integer between 0 and ${ds.dim}, got ${i}`);

  const vNew = ds._v.slice();
  const set = (D, x) => { vNew[i * ds.size + D - 1] = x; };

  for (const [D, v] of specs) {
    _assert(ds.isElement(D), `need integer between 1 and ${ds.size}, got ${D}`);
    _assert(Number.isInteger(v) && v >= 0,
            `need non-negative integer, got ${v}`);

    let E = D;
    do {
      E = ds.s(i, E) || E;
      set(E, v);
      E = ds.s(i+1, E) || E;
      set(E, v);
    }
    while (E != D);
  }

  return _dsymbol(ds.dim, ds._s, vNew);
};


export const build = (dim, size, pairingsFn, branchingsFn) => {
  let ds = _dsymbol(dim, new Array((dim+1) * size), new Array(dim * size));

  const ds0 = ds;
  for (let i = 0; i <= dim; ++i)
    ds = withPairings(ds, i, pairingsFn(ds0, i));

  const ds1 = ds;
  for (let i = 0; i < dim; i++)
    ds = withBranchings(ds, i, branchingsFn(ds1, i));

  return ds;
};


export const parse = str => {
  const _parseInts = str => str.trim().split(/\s+/).map(s => parseInt(s));

  const parts = str.trim().replace(/^</, '').replace(/>$/, '').split(/:/);
  if (parts[0].match(/\d+\.\d+/))
    parts.shift();

  const dims = _parseInts(parts[0]);
  const size = dims[0];
  const dim  = dims[1] || 2;

  const gluings = parts[1].split(/,/).map(_parseInts);
  const degrees = parts[2].split(/,/).map(_parseInts);

  const s = new Array((dim+1) * size);
  const v = new Array(dim * size);

  const get = (a, i, D)    => a[i * size + D - 1];
  const set = (a, i, D, x) => { a[i * size + D - 1] = x; };

  for (let i = 0; i <= dim; ++i) {
    let k = -1;
    for (let D = 1; D <= size; ++D) {
      if (!get(s, i, D)) {
        const E = gluings[i][++k];
        set(s, i, D, E);
        set(s, i, E, D);
      }
    }
  }

  for (let i = 0; i < dim; ++i) {
    let k = -1;
    for (let D = 1; D <= size; ++D) {
      if (!get(v, i, D)) {
        const m = degrees[i][++k];
        let E = D;
        let r = 0;

        do {
          E = get(s, i, E) || E;
          E = get(s, i+1, E) || E;
          ++r;
        }
        while (E != D);

        const b = m / r;

        do {
          E = get(s, i, E) || E;
          set(v, i, E, b);
          E = get(s, i+1, E) || E;
          set(v, i, E, b);
        }
        while (E != D);
      }
    }
  }

  return _dsymbol(dim, s, v);
};


export const orbitReps1 = (ds, i) =>
  ds.elements().filter(D => (ds.s(i, D) || D) >= D);


export const orbit2 = (ds, i, j, D) => {
  const seen = new Array(ds.size + 1);
  const result = [];

  let E = D;
  do {
    for (const k of [i, j]) {
      E = ds.s(k, E) || E;
      if (!seen[E]) {
        result.push(E);
        seen[E] = true;
      }
    }
  }
  while (E != D);

  return result;
};


export const orbitReps2 = (ds, i, j) => {
  const seen = new Array(ds.size + 1);
  const result = [];

  ds.elements().forEach(D => {
    if (!seen[D]) {
      let E = D;

      do {
        E = ds.s(i, E) || E;
        seen[E] = true;
        E = ds.s(j, E) || E;
        seen[E] = true;
      }
      while (E != D);

      result.push(D);
    }
  });

  return I.List(result);
};


export const stringify = ds => {
  const sDefs = ds.indices()
    .map(i => (
      orbitReps1(ds, i)
        .map(D => ds.s(i, D) || 0)
        .join(' ')))
    .join(',');

  const mDefs = ds.indices()
    .filter(i => ds.isIndex(i+1))
    .map(i => (
      orbitReps2(ds, i, i+1)
        .map(D => m(ds, i, i+1, D) || 0)
        .join(' ')))
    .join(',');

  const n = ds.size;
  const d = ds.dim;

  return '<1.1:'+n+(d == 2 ? '' : ' '+d)+':'+sDefs+':'+mDefs+'>';
};


export const r = (ds, i, j, D) => {
  let k = 0;
  let E = D;

  do {
    E = ds.s(i, E) || E;
    E = ds.s(j, E) || E;
    ++k;
  }
  while (E != D);

  return k;
};


export const isElement = (ds, D) => ds.isElement(D);
export const elements = ds => ds.elements();
export const size = ds => ds.size;

export const isIndex = (ds, i) => ds.isIndex(i);
export const indices = ds => ds.indices();
export const dim = ds => ds.dim;

export const s = (ds, i, D) => ds.s(i, D);
export const v = (ds, i, j, D) => ds.v(i, j, D);
export const m = (ds, i, j, D) => ds.v(i, j, D) * r(ds, i, j, D);


export const parseSymbols = text => text
  .split('\n')
  .filter(line => !line.match(/^\s*(#.*)?$/))
  .map(parse);


if (require.main == module) {
  const ds = parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log(stringify(ds));
  console.log(`${ds}`);

  console.log(`${withPairings(ds, 1, [[2,1]])}`);
  console.log(`${withBranchings(ds, 0, [[2,3],[1,5]])}`);
}
