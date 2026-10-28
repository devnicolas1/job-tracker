import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';

import { resolveFont } from './fonts';
import type { Paragraph, ResumeLayout, TextRun, TextStyle } from './model';
import { TAB } from './segment';
import { flow, type PlacedParagraph } from './flow';
import type { TypesetLine } from './typeset';

/*
 * Draws a layout. There is no design here: every position, size and colour comes from the model,
 * which was measured from the user's PDF. Lines are broken here, word-processor style (see
 * typeset.ts) and placed on a single pageless sheet (see flow.ts); react-pdf only draws them.
 *
 * react-pdf puts a line's baseline at (line box top + font ascent) and stacks line boxes
 * `lineHeight` apart, so a paragraph whose first baseline must sit `spaceBefore` below the
 * previous last baseline needs: marginTop = spaceBefore − (previous box below its baseline) − ascent.
 */

const runStyle = (style: TextStyle) => {
  const font = resolveFont(style.font);
  return {
    fontFamily: font.fontFamily,
    fontWeight: font.fontWeight,
    fontStyle: font.fontStyle,
    fontSize: style.size,
    color: style.color,
  };
};

/** Distance from a line box's top to its baseline: the tallest run's ascent. */
const ascentOf = (paragraph: Paragraph) =>
  Math.max(...paragraph.runs.map((run) => resolveFont(run.font).ascent * run.size));

function Runs({ runs }: { runs: readonly TextRun[] }) {
  return runs.map((run, index) => (
    <Text key={index} style={runStyle(run)}>
      {run.text}
    </Text>
  ));
}

/** Splits runs at tab characters, for "title ⇥ date" lines. */
function splitAtTabs(runs: readonly TextRun[]): TextRun[][] {
  const parts: TextRun[][] = [];
  let part: TextRun[] = [];
  for (const run of runs) {
    run.text.split(TAB).forEach((text, index) => {
      if (index > 0) {
        parts.push(part);
        part = [];
      }
      if (text) part.push({ ...run, text });
    });
  }
  parts.push(part);
  return parts;
}

/** Lines can never re-wrap inside react-pdf: they get this much slack beyond the measured width. */
const SLACK = 2;

const measure = (text: string, style: TextStyle) =>
  resolveFont(style.font).widthOf(text, style.size);

function Line({
  line,
  align,
  isLast,
  lineHeight,
}: {
  line: TypesetLine;
  align: Paragraph['align'];
  isLast: boolean;
  lineHeight: string;
}) {
  if (line.runs.some((run) => run.text.includes(TAB))) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {splitAtTabs(line.runs).map((part, index) => (
          <Text key={index} style={{ lineHeight }}>
            <Runs runs={part} />
          </Text>
        ))}
      </View>
    );
  }
  if (align === 'justify' && !isLast && line.words.length > 1) {
    // Flexbox spreads the leftover width evenly between words: that is justification.
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {line.words.map((word, index) => (
          <Text key={index} style={{ lineHeight, flexShrink: 0 }}>
            <Runs runs={word} />
          </Text>
        ))}
      </View>
    );
  }
  const offset = align === 'center' ? -SLACK / 2 : align === 'right' ? -SLACK : 0;
  return (
    <Text
      style={{
        lineHeight,
        textAlign: align === 'justify' ? 'left' : align,
        marginLeft: offset,
        marginRight: -SLACK - offset,
      }}
    >
      <Runs runs={line.runs} />
    </Text>
  );
}

function ParagraphView({ placed: { paragraph, lines, marginTop } }: { placed: PlacedParagraph }) {
  const lineHeight = `${paragraph.lineHeight}pt`;
  const width = paragraph.right - paragraph.left;

  return (
    <>
      <View style={{ marginTop, marginLeft: paragraph.left, width }}>
        {paragraph.marker && (
          <Text
            style={{
              ...runStyle(paragraph.marker.style),
              position: 'absolute',
              left: paragraph.marker.x - paragraph.left,
              top: 0,
              lineHeight,
            }}
          >
            {paragraph.marker.text}
          </Text>
        )}
        {lines.map((line, index) => (
          <Line
            key={index}
            line={line}
            align={paragraph.align}
            isLast={index === lines.length - 1}
            lineHeight={lineHeight}
          />
        ))}
      </View>
      {paragraph.rules.map((rule, index) => (
        <View
          key={index}
          style={{
            // The rule's top edge sits `offset − thickness/2` below the last baseline.
            marginTop:
              rule.offset - rule.thickness / 2 - (paragraph.lineHeight - ascentOf(paragraph)),
            marginLeft: rule.x1,
            width: rule.x2 - rule.x1,
            // A filled bar, not a border: borders are stroked outlines, a few points off.
            height: rule.thickness,
            backgroundColor: rule.color,
          }}
        />
      ))}
    </>
  );
}

export function ResumeDocumentPdf({ layout }: { layout: ResumeLayout }) {
  const { margin, height, paragraphs } = flow(layout, { measure, ascentOf });

  return (
    <Document>
      <Page
        // An explicit height computed from the measured layout. (`wrap={false}` would make
        // react-pdf ignore it and shrink the page to its own estimate of the content, which
        // drops part of the bottom margin.) The height leaves a full margin of slack, so
        // nothing can spill onto a second page.
        size={[layout.pageWidth, height]}
        style={{
          paddingTop: margin,
          backgroundColor: layout.pageBackground,
          // No ligatures: fi, fl, ti would merge letters in the text layer, so applicant-
          // tracking systems would read "fnancial". Kerning stays on, as in word processors.
          fontFeatureSettings: { liga: false, clig: false },
        }}
      >
        {paragraphs.map((placed) => (
          <ParagraphView key={placed.paragraph.id} placed={placed} />
        ))}
      </Page>
    </Document>
  );
}

export function renderLayout(layout: ResumeLayout): Promise<Buffer> {
  return renderToBuffer(<ResumeDocumentPdf layout={layout} />);
}
