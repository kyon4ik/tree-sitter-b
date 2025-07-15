const PREC = {
  PRIMARY: 0,
  ASSIGNMENT: 1,
  CONDITIONAL: 5,
  OR: 10,
  AND: 20,
  EQUAL: 30,
  RELATIONAL: 40,
  SHIFT: 50,
  ADD: 60,
  MULTIPLY: 70,
  UNARY: 80,
  CALL: 90,
  OFFSET: 100,
};

const binaryOp = [
  '|',
  '&',
  '==', '!=',
  '<', '<=', '>', '>=',
  '<<', '>>',
  '-', '+',
  '%', '*', '/'
];

module.exports = grammar({
  name: 'b',

  // Define tokens that can appear anywhere between other tokens (like whitespace and comments).
  extras: $ => [
    /\s/,
    $.comment
  ],

  word: $ => $.name,

  rules: {
    program: $ => repeat($.definition),

    definition: $ => choice(
      $.vector_definition,
      $.function_definition
    ),
    
    vector_definition: $ => seq(
      $.name,
      optional(seq(
        '[',
        field('length', optional($.constant)),
        ']'
      )),
      field('initializers', sepBy(',', $.immediate_value)),
      ';'
    ),

    function_definition: $ => seq(
      $.name,
      '(',
      field('parameters', sepBy(',', $.name)),
      ')',
      field('body', $.statement)
    ),

    immediate_value: $ => choice($.name, $.constant),
    
    statement: $ => choice(
      // Auto declaration
      seq(
        'auto',
        sepBy1(',', seq($.name, optional($.constant))),
        ';',
        $.statement
      ),
      // External declaration
      seq(
        'extrn',
        sepBy1(',', $.name),
        ';',
        $.statement
      ),
      // Label
      seq($.name, ':', $.statement),
      // Case
      seq('case', $.constant, ':', $.statement),
      // Compound statement
      seq('{', repeat($.statement), '}'),
      // Conditional statement
      prec.right(seq(
        'if', '(', $.expression, ')', $.statement,
        optional(seq('else', $.statement)) 
      )),
      // While statement
      seq('while', '(', $.expression, ')', $.statement),
      // Switch statement
      seq('switch', $.expression, $.statement),
      // Goto
      seq('goto', $.expression, ';'),
      // Return
      seq('return', optional(seq('(', $.expression, ')')), ';'),
      // Expression
      seq(optional($.expression), ';')
    ),

    expression: $ => choice(
      $.assignment_expression,
      $.conditional_expression,
      $.binary_expression,
      $.unary_expression,
      $.call_expression,
      $.offset_expression,
      $.primary_expression
    ),

    assignment_expression: $ => prec.right(PREC.ASSIGNMENT, seq(
      field('left', $.expression),
      field('operator', $.assign_op),
      field('right', $.expression)
    )),

    assign_op: $ => token(seq('=', optional(choice(...binaryOp)))),

    conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      field('condition', $.expression),
      '?',
      field('consequence', $.expression),
      ':',
      field('alternative', $.expression)
    )),

    binary_expression: $ => {
      const table = [
        [PREC.AND, '&'],
        [PREC.OR, '|'],
        [PREC.EQUAL, choice('==', '!=')],
        [PREC.RELATIONAL, choice('<', '<=', '>', '>=')],
        [PREC.SHIFT, choice('<<', '>>')],
        [PREC.ADD, choice('+', '-')],
        [PREC.MULTIPLY, choice('*', '/', '%')],
      ];

      return choice(...table.map(([precedence, operator]) => prec.left(precedence, seq(
        field('left', $.expression),
        field('operator', operator),
        field('right', $.expression),
      ))));
    },
    
    unary_expression: $ => prec.right(PREC.UNARY, choice(
      seq(choice('-', '!', '--', '++', '&', '*'), $.expression),
      seq($.expression, choice('--', '++'))
    )),
    
    call_expression: $ => prec.left(PREC.CALL, seq(
      field('callee', $.expression),
      '(',
      field('arguments', sepBy(',', $.expression)),
      ')'
    )),
    
    offset_expression: $ => prec.left(PREC.OFFSET, seq(
      field('base', $.expression),
      '[',
      field('offset', $.expression),
      ']'
    )),

    primary_expression: $ => choice(
      $.name,
      $.constant,
      seq('(', $.expression, ')')
    ),

    constant: $ => choice(
      $.integer_constant,
      $.char_constant,
      $.string_constant
    ),

    integer_constant: $ => token(/[0-9]+/),

    char_constant: $ => seq(
      "'",
      repeat1(choice(
        /[^'\n\r*]/,
        $.escape_sequence
      )),
      "'"
    ),

    string_constant: $ => seq(
      '"',
      repeat(choice(
        /[^"\n\r*]/,
        $.escape_sequence
      )),
      '"'
    ),

    escape_sequence: $ => seq('*', choice('0', 'e', '(', ')', 't', '*', "'", '"', 'n')),

    name: $ => token(/[a-zA-Z_][a-zA-Z0-9_]+/),

    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890 
    comment: $ => token(seq(
      '/*',
      /[^*]*\*+([^/*][^*]*\*+)*/,
      '/'
    )),
  }
});

/**
 * Creates a rule to match one or more of the rules separated by the separator.
 *
 * @param {RuleOrLiteral} sep - The separator to use.
 * @param {RuleOrLiteral} rule
 *
 * @returns {SeqRule}
 */
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}


/**
 * Creates a rule to optionally match one or more of the rules separated by the separator.
 *
 * @param {RuleOrLiteral} sep - The separator to use.
 * @param {RuleOrLiteral} rule
 *
 * @returns {ChoiceRule}
 */
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}
