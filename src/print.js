const {
  align, concat, dedent, group, hardline, ifBreak, indent, join, line,
  literalline, markAsRoot, softline
} = require("prettier").doc.builders;

const { printBlock } = require("./blocks");
const { printIf, printUnless, printTernary } = require("./conditionals");
const { printWhile, printUntil, printFor } = require("./loops");
const { printDef, printDefs } = require("./methods");
const { printKwargRestParam, printRestParam, printParams } = require("./params");

const lineNoFrom = require("./layout");

const concatBody = (path, options, print) => concat(path.map(print, "body"));

const nodes = {
  alias: (path, options, print) => concat([
    "alias ",
    join(" ", path.map(print, "body"))
  ]),
  aref: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    "[",
    indent(concat([softline, path.call(print, "body", 1)])),
    concat([softline, "]"])
  ])),
  aref_field: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    "[",
    indent(concat([softline, path.call(print, "body", 1)])),
    concat([softline, "]"])
  ])),
  arg_paren: (path, options, print) => {
    if (path.getValue().body[0] === null) {
      return "";
    }

    return group(concat([
      "(",
      indent(concat([softline, path.call(print, "body", 0)])),
      concat([softline, ")"])
    ]))
  },
  args_add: (path, options, print) => {
    if (path.getValue().body[0].type === "args_new") {
      return path.call(print, "body", 1);
    }

    return concat([
      path.call(print, "body", 0),
      ",",
      line,
      path.call(print, "body", 1)
    ]);
  },
  args_add_block: (path, options, print) => {
    const [args, block] = path.getValue().body;
    const parts = args.type === "args_new" ? [] : [path.call(print, "body", 0)];

    if (block) {
      if (parts.length > 0) {
        parts.push(",", line);
      }
      parts.push(concat(["&", path.call(print, "body", 1)]));
    }

    return group(concat(parts));
  },
  args_add_star: (path, options, print) => {
    if (path.getValue().body[0].type === "args_new") {
      return concat(["*", path.call(print, "body", 1)]);
    }

    return concat([
      path.call(print, "body", 0),
      ",",
      line,
      concat(["*", path.call(print, "body", 1)])
    ]);
  },
  args_new: (path, options, print) => group(concat(["[", softline])),
  array: (path, options, print) => {
    if (path.getValue().body[0] === null) {
      return '[]';
    }

    const firstTypeOf = element => element.parts ? findStart(element.parts[0]) : element.type;
    const initial = firstTypeOf(path.getValue().body[0]) === "args_add" ? "[" : "";

    return group(concat([
      initial,
      softline,
      indent(path.call(print, "body", 0)),
      softline,
      "]"
    ]));
  },
  assoc_new: (path, options, print) => {
    const parts = [];

    switch (path.getValue().body[0].type) {
      case "@label":
        parts.push(path.call(print, "body", 0));
        break;
      case "symbol_literal":
        parts.push(concat([
          path.call(print, "body", 0).parts[0].parts[1],
          ":"
        ]));
        break;
      default:
        parts.push(path.call(print, "body", 0), " =>")
        break;
    }

    parts.push(line, indent(path.call(print, "body", 1)));

    return group(concat(parts));
  },
  assoc_splat: (path, options, print) => group(concat([
    "**",
    path.call(print, "body", 0)
  ])),
  assoclist_from_args: (path, options, print) => group(
    join(concat([",", line]),
    path.map(print, "body", 0))
  ),
  assign: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    " =",
    indent(concat([line, path.call(print, "body", 1)]))
  ])),
  bare_assoc_hash: (path, options, print) => group(
    join(concat([",", line]),
    path.map(print, "body", 0)
  )),
  begin: (path, options, print) => group(concat([
    "begin",
    indent(concat([hardline, concat(path.map(print, "body"))])),
    group(concat([hardline, "end"]))
  ])),
  binary: (path, options, print) => group(concat([
    concat([path.call(print, "body", 0), " "]),
    path.getValue().body[1],
    indent(concat([line, path.call(print, "body", 2)]))
  ])),
  block_var: (path, options, print) => concat(["|", path.call(print, "body", 0), "| "]),
  blockarg: (path, options, print) => concat(["&", path.call(print, "body", 0)]),
  bodystmt: (path, options, print) => {
    const [statements, ...additions] = path.getValue().body;
    const parts = [path.call(print, "body", 0)];

    additions.forEach((addition, index) => {
      if (addition) {
        parts.push(dedent(concat([
          hardline,
          path.call(print, "body", index + 1)
        ])));
      }
    });

    return group(concat(parts));
  },
  brace_block: printBlock,
  break: (path, options, print) => {
    if (path.getValue().body[0].length > 0) {
      return concat(["break ", path.call(print, "body", 0)]);
    }
    return "break";
  },
  call: (path, options, print) => join(path.getValue().body[1], [
    path.call(print, "body", 0),
    path.call(print, "body", 2)
  ]),
  case: (path, options, print) => {
    const parts = ["case "];

    if (path.getValue().body[0]) {
      parts.push(path.call(print, "body", 0));
    }

    parts.push(
      group(concat([hardline, path.call(print, "body", 1)])),
      group(concat([hardline, "end"]))
    );

    return group(concat(parts));
  },
  class: (path, options, print) => {
    const [_constant, superclass, _statements] = path.getValue().body;
    const parts = [concat(["class ", path.call(print, "body", 0)])];

    if (superclass) {
      parts.push(concat([" < ", path.call(print, "body", 1)]));
      parts.push(indent(concat([hardline, path.call(print, "body", 2)])));
    } else {
      parts.push(indent(path.call(print, "body", 2)));
    }

    parts.push(concat([hardline, "end"]));

    return group(concat(parts));
  },
  command: (path, options, print) => group(join(" ", path.map(print, "body"))),
  command_call: (path, options, print) => {
    const [_target, operator, _method, _args] = path.getValue().body;

    return group(concat([
      path.call(print, "body", 0),
      operator,
      path.call(print, "body", 2),
      " ",
      path.call(print, "body", 3)
    ]));
  },
  const_path_field: (path, options, print) => join("::", path.map(print, "body")),
  const_path_ref: (path, options, print) => join("::", path.map(print, "body")),
  const_ref: (path, options, print) => path.call(print, "body", 0),
  def: printDef,
  defs: printDefs,
  defined: (path, options, print) => group(concat([
    "defined?(",
    softline,
    indent(concat(path.map(print, "body"))),
    softline,
    ")"
  ])),
  do_block: printBlock,
  dot2: (path, options, print) => concat([
    path.call(print, "body", 0),
    "..",
    path.call(print, "body", 1)
  ]),
  dot3: (path, options, print) => concat([
    path.call(print, "body", 0),
    "...",
    path.call(print, "body", 1)
  ]),
  dyna_symbol: (path, options, print) => concat([
    ":\"",
    concat(path.map(print, "body")),
    "\""
  ]),
  else: (path, options, print) => concat([
    "else",
    indent(concat([softline, path.call(print, "body", 0)]))
  ]),
  elsif: (path, options, print) => {
    const [_predicate, _statements, addition] = path.getValue().body;
    const parts = [
      group(concat(["elsif ", path.call(print, "body", 0)])),
      indent(concat([hardline, path.call(print, "body", 1)]))
    ];

    if (addition) {
      parts.push(group(concat([hardline, path.call(print, "body", 2)])));
    }

    return group(concat(parts));
  },
  ensure: (path, options, print) => group(concat([
    "ensure",
    indent(concat([hardline, concat(path.map(print, "body"))]))
  ])),
  fcall: concatBody,
  field: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    path.getValue().body[1],
    path.call(print, "body", 2)
  ])),
  for: printFor,
  hash: (path, options, print) => {
    if (path.getValue().body[0] === null) {
      return '{}';
    }

    return group(concat([
      "{",
      indent(concat([line, concat(path.map(print, "body"))])),
      concat([line, "}"])
    ]));
  },
  if: printIf,
  ifop: printTernary,
  if_mod: printIf,
  lambda: (path, options, print) => {
    const args = path.call(print, "body", 0);

    return group(ifBreak(
      concat([
        "lambda do",
        args.parts[0] === "(" ? concat([" |", args.parts[1], "|"]) : args,
        indent(concat([softline, path.call(print, "body", 1)])),
        concat([softline, "end"])
      ]),
      concat([
        "->",
        args,
        " { ",
        path.call(print, "body", 1),
        " }"
      ])
    ));
  },
  kwrest_param: printKwargRestParam,
  massign: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    " =",
    indent(concat([line, path.call(print, "body", 1)]))
  ])),
  method_add_arg: (path, options, print) => {
    if (path.getValue().body[1].type === "args_new") {
      return path.call(print, "body", 0);
    }
    return group(concat(path.map(print, "body")));
  },
  method_add_block: (path, options, print) => concat(path.map(print, "body")),
  mlhs_add: (path, options, print) => {
    if (path.getValue().body[0].type === "mlhs_new") {
      return path.call(print, "body", 1);
    }

    return concat([
      path.call(print, "body", 0),
      ",",
      line,
      path.call(print, "body", 1)
    ]);
  },
  mlhs_add_post: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    ",",
    group(concat([line, path.call(print, "body", 1)]))
  ])),
  mlhs_add_star: (path, options, print) => {
    const star = path.getValue().body[1] ? concat(["*", path.call(print, "body", 1)]) : "*"

    return group(concat([
      path.call(print, "body", 0),
      ",",
      line,
      star
    ]));
  },
  mrhs_add_star: (path, options, print) => group(concat([
    "*",
    concat(path.map(print, "body"))
  ])),
  mlhs_paren: (path, options, print) => group(concat([
    "(",
    indent(concat([softline, path.call(print, "body", 0)])),
    concat([softline, ")"])
  ])),
  mlhs_new: (path, options, print) => "",
  mrhs_new_from_args: (path, options, print) => path.call(print, "body", 0),
  module: (path, options, print) => group(concat([
    group(concat(["module ", path.call(print, "body", 0)])),
    indent(path.call(print, "body", 1)),
    concat([hardline, "end"])
  ])),
  mrhs_add: (path, options, print) => {
    if (path.getValue().body[0].type === "mrhs_new") {
      return path.call(print, "body", 1);
    }

    return group(concat([
      path.call(print, "body", 0),
      ",",
      line,
      path.call(print, "body", 1)
    ]));
  },
  mrhs_new: (path, options, print) => "",
  next: (path, options, print) => {
    if (path.getValue().body.length > 0) {
      return concat(["next ", path.call(print, "body", 0)]);
    }
    return "next";
  },
  opassign: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    " ",
    path.call(print, "body", 1),
    indent(concat([line, path.call(print, "body", 2)]))
  ])),
  params: printParams,
  paren: (path, options, print) => (
    concat(["(", concat(path.getValue().body.reduce((parts, part, index) => {
      if (Array.isArray(part)) {
        return parts.concat(path.map(print, "body", index));
      }
      return [...parts, path.call(print, "body", index)];
    }, [])), ")"])
  ),
  program: (path, options, print) => markAsRoot(concat([
    join(literalline, path.map(print, "body")),
    literalline
  ])),
  qsymbols_add: (path, options, print) => concat([
    path.call(print, "body", 0),
    path.getValue().body[0].type === "qsymbols_new" ? "" : line,
    path.call(print, "body", 1)
  ]),
  qsymbols_new: (path, options, print) => group(concat(["%i[", softline])),
  qwords_add: (path, options, print) => concat([
    path.call(print, "body", 0),
    path.getValue().body[0].type === "qwords_new" ? "" : line,
    path.call(print, "body", 1)
  ]),
  qwords_new: (path, options, print) => group(concat(["%w[", softline])),
  redo: (path, options, print) => "redo",
  regexp_add: concatBody,
  regexp_literal: (path, options, print) => {
    const delim = path.call(print, "body", 1);

    const delimPairs = { "]": "[", "}": "{", ")": "(" };
    const startDelim = delim[0] === "/" ? "/" : `%r${delimPairs[delim[0]]}`;

    return group(concat([
      startDelim,
      indent(concat([softline, path.call(print, "body", 0)])),
      softline,
      delim
    ]));
  },
  regexp_new: (path, options, print) => "",
  rescue: (path, options, print) => {
    const [exception, variable, _statements, addition] = path.getValue().body;
    const parts = ["rescue"];

    if (exception) {
      parts.push(" ");
      parts.push(Array.isArray(exception) ? path.call(print, "body", 0, 0) : path.call(print, "body", 0));
    }

    if (variable) {
      parts.push(group(concat([" => ", path.call(print, "body", 1)])));
    }

    parts.push(indent(concat([hardline, path.call(print, "body", 2)])));

    if (addition) {
      parts.push(concat([hardline, path.call(print, "body", 3)]));
    }

    return group(concat(parts));
  },
  rescue_mod: (path, options, print) => group(join(" rescue ", path.map(print, "body"))),
  rest_param: printRestParam,
  retry: (path, options, print) => "retry",
  return: (path, options, print) => group(concat(["return ", concat(path.map(print, "body"))])),
  return0: (path, options, print) => "return",
  sclass: (path, options, print) => group(concat([
    group(concat([hardline, "class << ", path.call(print, "body", 0)])),
    indent(path.call(print, "body", 1)),
    concat([hardline, "end"])
  ])),
  stmts_add: (path, options, print) => {
    const [leftStatement, rightStatement] = path.getValue().body;
    const leftLineNo = lineNoFrom(leftStatement);

    let buffer = hardline;
    if (leftLineNo) {
      const rightLineNo = lineNoFrom(rightStatement);

      if ((rightLineNo - leftLineNo) > 1) {
        buffer = concat([hardline, hardline]);
      }
    }

    if (path.getValue().body[0].type === "stmts_new") {
      return path.call(print, "body", 1);
    }
    return group(join(buffer, path.map(print, "body")));
  },
  stmts_new: (path, options, print) => "",
  string_concat: (path, options, print) => group(concat([
    path.call(print, "body", 0),
    " \\",
    indent(concat([hardline, path.call(print, "body", 1)]))
  ])),
  string_content: (path, options, print) => "",
  string_add: (path, options, print) => [
    ...path.call(print, "body", 0),
    path.call(print, "body", 1)
  ],
  string_embexpr: (path, options, print) => concat([
    "#{",
    path.call(print, "body", 0),
    "}"
  ]),
  string_literal: (path, { preferSingleQuotes }, print) => {
    const parts = path.call(print, "body", 0);
    if (parts === '') {
      return preferSingleQuotes ? "''" : "\"\"";
    }

    let delim = "\"";
    if (preferSingleQuotes && parts.every(part => !part.parts || part.parts[0] !== "#{")) {
      delim = "\'";
    }

    return concat([delim, ...parts, delim]);
  },
  super: (path, options, print) => group(concat([
    "super",
    path.call(print, "body", 0)
  ])),
  symbol: (path, options, print) => concat([
    ":",
    concat(path.map(print, "body"))
  ]),
  symbol_literal: concatBody,
  symbols_add: (path, options, print) => concat([
    path.call(print, "body", 0),
    path.getValue().body[0].type === "symbols_new" ? "" : line,
    path.call(print, "body", 1)
  ]),
  symbols_new: (path, options, print) => group(concat(["%I[", softline])),
  top_const_field: (path, options, print) => group(concat([
    "::",
    path.call(print, "body", 0)
  ])),
  top_const_ref: (path, options, print) => group(concat([
    "::",
    path.call(print, "body", 0)
  ])),
  unary: (path, options, print) => concat([
    path.getValue().body[0][0],
    path.call(print, "body", 1)
  ]),
  undef: (path, options, print) => concat(["undef ", concat(path.map(print, "body", 0))]),
  unless: printUnless,
  unless_mod: printUnless,
  until: printUntil,
  until_mod: printUntil,
  var_field: concatBody,
  var_ref: (path, options, print) => path.call(print, "body", 0),
  vcall: concatBody,
  void_stmt: (path, options, print) => "",
  when: (path, options, print) => {
    const [_predicates, _statements, addition] = path.getValue().body;
    const parts = [
      group(concat(["when ", path.call(print, "body", 0)])),
      indent(concat([hardline, path.call(print, "body", 1)]))
    ];

    if (addition) {
      parts.push(concat([hardline, path.call(print, "body", 2)]));
    }

    return group(concat(parts));
  },
  while: printWhile,
  while_mod: printWhile,
  word_add: concatBody,
  word_new: (path, options, print) => "",
  words_add: (path, options, print) => concat([
    path.call(print, "body", 0),
    path.getValue().body[0].type === "words_new" ? "" : line,
    path.call(print, "body", 1)
  ]),
  words_new: (path, options, print) => group(concat(["%W[", softline])),
  xstring_add: concatBody,
  xstring_literal: (path, options, print) => group(concat([
    "%x[",
    softline,
    indent(concat(path.map(print, "body"))),
    softline,
    "]"
  ])),
  xstring_new: (path, options, print) => "",
  yield: (path, options, print) => concat([
    "yield ",
    concat(path.map(print, "body"))
  ]),
  yield0: (path, options, print) => "yield",
  zsuper: (path, options, print) => "super"
};

const debugNode = (path, { filepath }, print) => {
  console.log("=== UNSUPPORTED NODE ===");
  console.log(filepath);
  console.log(JSON.stringify(path.getValue(), null, 2));
  console.log("========================");
  return "";
};

const genericPrint = (path, options, print) => {
  const { type, body } = path.getValue();

  if (type[0] === "@") {
    return body;
  }

  return (nodes[type] || debugNode)(path, options, print);
};

module.exports = genericPrint;
