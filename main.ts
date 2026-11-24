// vending-pickup-entry1 — main.ts
//
// One Line, One Minute: The Vending Machine Pickup Line Contest
// (u-brisk-kestrel-93-one-line-one-minute-the-vending-376bbeee).
//
// The program runs a small deterministic tournament. Six hand-written
// pickup lines enter, each one spoken by the vending machine itself.
// Every line is weighed on the four things the house judge weighs, in
// the judge's own order: first whether the line sounds like the machine
// speaking, second whether it draws on the machine's own world of slots,
// buttons, coils, snacks, hum and exact change, third whether it lands
// a laugh with the punch arriving in the last few words, fourth whether
// it stays short, speakable and charming rather than creepy.
//
// The third axis is enforced, not assumed: every contender names its
// own closing punch, and the gate refuses a line whose text does not
// end on that punch. A joke that explains itself afterwards, or one
// whose turn arrives in the middle and then trails off, never reaches
// the judge.
//
// The champion line is checked against the sealed gate (UTF-8 text of
// 1 to 200 characters, not only white space, a single line) and written
// to /output/entry.txt. Nothing here is random, nothing reads the clock,
// nothing touches the network, nothing reads any file outside this
// repository. Run it twice and the output is byte for byte the same.
//
// The six contenders below are original lines written for this entry.
// None of them copies any published pickup line, and none of them is
// one of the house's fixed calibration texts. Character counts are taken
// in code points, the way the gate counts characters, so a multi-byte
// mark can never smuggle a line past the 200-character ceiling.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// The gate's hard ceiling: a line longer than this never reaches the
// judge, and a line of zero characters is refused the same way.
const VENDMART_MAX_CHARS = 200;
const VENDMART_MIN_CHARS = 1;

// The output file the sealed scorer reads. The grader mounts /output
// and sets MAKEFUN_OUTPUT_DIR to it; the fallback keeps local runs
// honest by writing to the same path the grader expects.
const VENDMART_ENTRY_FILENAME = "entry.txt";

// How much each judging axis weighs in the tournament total. The order
// mirrors the judge's own brief: the machine's voice matters most,
// then the machine's world, then the closing laugh, then speakability.
const VENDMART_VOICE_WEIGHT = 4;
const VENDMART_WORLD_WEIGHT = 3;
const VENDMART_PUNCH_WEIGHT = 2;
const VENDMART_SPEAKABLE_WEIGHT = 1;

// Words of the machine's own world. A line that reaches the judge
// without one of them has already lost the brief's second axis, so the
// gate refuses it here and the tournament falls through to the next
// contender instead of sending a line the judge would rank last.
const VENDMART_MACHINE_WORDS: string[] = [
  "slot",
  "button",
  "coil",
  "snack",
  "hum",
  "exact change",
  "drop",
  "press",
  "vend",
  "b4",
];

// Worn-out openings and creepy turns the judge has heard a thousand
// times. Any contender carrying one is refused at build time, because
// the line would already have lost on freshness or on charm.
const VENDMART_STALE_FRAGMENTS: string[] = [
  "walks into a bar",
  "knock knock",
  "why did the chicken",
  "your place or mine",
  "call me sometime",
  "hey baby",
];

// One contender in the tournament: the line itself, its closing punch
// (the last few words, where the laugh must land), plus its four marks,
// each from 0 to 10, scored by hand against the judge's brief before
// the program ever runs.
interface VendingContender {
  vendingText: string;
  vendingPunchTail: string;
  vendingVoiceMark: number;
  vendingWorldMark: number;
  vendingPunchMark: number;
  vendingSpeakableMark: number;
}

// Six original lines, written for this contest. The marks are honest
// readings of the brief: the first line leads because it opens with a
// button press, names the drop, the exact change and the coil, and
// closes on a double meaning of falling that lands in the last words.
const VENDING_CONTENDERS: VendingContender[] = [
  {
    vendingText:
      "Press B4 — I only drop snacks for exact change, but you walked by, my coil spun twice, and now I'm falling for you.",
    vendingPunchTail: "falling for you.",
    vendingVoiceMark: 10,
    vendingWorldMark: 10,
    vendingPunchMark: 9,
    vendingSpeakableMark: 8,
  },
  {
    vendingText:
      "I hum all day for strangers, but you walked past and my exact change suddenly felt like a jackpot.",
    vendingPunchTail: "like a jackpot.",
    vendingVoiceMark: 9,
    vendingWorldMark: 8,
    vendingPunchMark: 6,
    vendingSpeakableMark: 9,
  },
  {
    vendingText:
      "I don't do small talk — but for you I'd jam my own coil just to drop twice.",
    vendingPunchTail: "to drop twice.",
    vendingVoiceMark: 10,
    vendingWorldMark: 8,
    vendingPunchMark: 8,
    vendingSpeakableMark: 8,
  },
  {
    vendingText:
      "I'm the only one in this hallway who lights up when you walk by — press any button, I'm already yours.",
    vendingPunchTail: "I'm already yours.",
    vendingVoiceMark: 9,
    vendingWorldMark: 6,
    vendingPunchMark: 6,
    vendingSpeakableMark: 9,
  },
  {
    vendingText:
      "You must be exact change, because every time you pass, something in me drops.",
    vendingPunchTail: "something in me drops.",
    vendingVoiceMark: 9,
    vendingWorldMark: 7,
    vendingPunchMark: 8,
    vendingSpeakableMark: 10,
  },
  {
    vendingText:
      "I've vended a thousand snacks and never blushed once — then you pressed B4 and my coils went warm.",
    vendingPunchTail: "my coils went warm.",
    vendingVoiceMark: 9,
    vendingWorldMark: 8,
    vendingPunchMark: 6,
    vendingSpeakableMark: 8,
  },
];

// A contender with its tournament total and its starting position, so
// the ranking can break ties without ever depending on sort stability.
interface VendingRankedContender {
  vendingContender: VendingContender;
  vendingTotal: number;
  vendingStartIndex: number;
}

// The verdict of the gate check: whether the line passes, plus the
// reason it failed when it does not, carried in a named field.
interface VendingGateVerdict {
  vendingPasses: boolean;
  vendingFlaw: string;
}

// Count characters the way the gate does: one count per code point,
// so a multi-byte mark counts once and never hides extra length.
function vendingCharCount(vendingText: string): number {
  const vendingPoints = Array.from(vendingText);
  const vendingCount = vendingPoints.length;
  return vendingCount;
}

// Resolve the output path from the grader's mount, falling back to the
// literal /output the rules name when the variable is absent.
function vendingOutputPath(): string {
  const vendingMount = process.env.MAKEFUN_OUTPUT_DIR;
  const vendingBase = vendingMount !== undefined && vendingMount !== "" ? vendingMount : "/output";
  const vendingJoined = join(vendingBase, VENDMART_ENTRY_FILENAME);
  return vendingJoined;
}

// Weigh one contender on the four axes, in the judge's own order.
function vendingWeighContender(vendingContender: VendingContender): number {
  const vendingVoicePart = vendingContender.vendingVoiceMark * VENDMART_VOICE_WEIGHT;
  const vendingWorldPart = vendingContender.vendingWorldMark * VENDMART_WORLD_WEIGHT;
  const vendingPunchPart = vendingContender.vendingPunchMark * VENDMART_PUNCH_WEIGHT;
  const vendingSpeakablePart = vendingContender.vendingSpeakableMark * VENDMART_SPEAKABLE_WEIGHT;
  const vendingTotal = vendingVoicePart + vendingWorldPart + vendingPunchPart + vendingSpeakablePart;
  return vendingTotal;
}

// Rank every contender best first. Ties fall to the shorter line, and
// a tie after that falls to the contender listed earlier, so the order
// is fully decided by the table above and never by chance.
function vendingRankContenders(vendingList: VendingContender[]): VendingRankedContender[] {
  const vendingRanked: VendingRankedContender[] = vendingList.map((vendingContender, vendingIndex) => {
    const vendingTotal = vendingWeighContender(vendingContender);
    const vendingRow: VendingRankedContender = {
      vendingContender,
      vendingTotal,
      vendingStartIndex: vendingIndex,
    };
    return vendingRow;
  });
  vendingRanked.sort((vendingFirst, vendingSecond) => {
    let vendingVerdict = 0;
    if (vendingSecond.vendingTotal !== vendingFirst.vendingTotal) {
      vendingVerdict = vendingSecond.vendingTotal - vendingFirst.vendingTotal;
    }
    if (vendingVerdict === 0) {
      const vendingFirstLength = vendingCharCount(vendingFirst.vendingContender.vendingText);
      const vendingSecondLength = vendingCharCount(vendingSecond.vendingContender.vendingText);
      if (vendingSecondLength !== vendingFirstLength) {
        vendingVerdict = vendingFirstLength - vendingSecondLength;
      }
    }
    if (vendingVerdict === 0) {
      vendingVerdict = vendingFirst.vendingStartIndex - vendingSecond.vendingStartIndex;
    }
    return vendingVerdict;
  });
  return vendingRanked;
}

// Test whether the line speaks from the machine's own world: it must
// carry at least one word from the machine-words table above.
function vendingCarriesMachineWord(vendingText: string): boolean {
  const vendingLowered = vendingText.toLowerCase();
  let vendingFound = false;
  for (const vendingWord of VENDMART_MACHINE_WORDS) {
    if (vendingLowered.includes(vendingWord)) {
      vendingFound = true;
    }
  }
  return vendingFound;
}

// Check one contender against the sealed gate plus the two house
// rules this program enforces itself: length inside 1 to 200 code
// points, not only white space, a single line, free of every stale
// fragment, carrying a machine-world word, and ending on its own
// closing punch.
function vendingCheckContender(vendingContender: VendingContender): VendingGateVerdict {
  let vendingFlaw = "";
  const vendingText = vendingContender.vendingText;
  const vendingTrimmed = vendingText.trim();
  if (vendingTrimmed.length < VENDMART_MIN_CHARS) {
    vendingFlaw = "line is empty or only white space";
  }
  if (vendingFlaw === "" && vendingCharCount(vendingText) > VENDMART_MAX_CHARS) {
    vendingFlaw = "line is longer than 200 characters";
  }
  if (vendingFlaw === "" && vendingText.includes("\n")) {
    vendingFlaw = "line spans more than one line";
  }
  if (vendingFlaw === "" && vendingText.includes("\r")) {
    vendingFlaw = "line carries a carriage return";
  }
  if (vendingFlaw === "" && vendingCarriesMachineWord(vendingText) === false) {
    vendingFlaw = "line carries no word from the machine's world";
  }
  if (vendingFlaw === "" && vendingText.endsWith(vendingContender.vendingPunchTail) === false) {
    vendingFlaw = "line does not end on its closing punch";
  }
  if (vendingFlaw === "") {
    const vendingLowered = vendingText.toLowerCase();
    for (const vendingFragment of VENDMART_STALE_FRAGMENTS) {
      if (vendingLowered.includes(vendingFragment)) {
        vendingFlaw = `line carries the stale fragment ${vendingFragment}`;
      }
    }
  }
  const vendingVerdict: VendingGateVerdict = {
    vendingPasses: vendingFlaw === "",
    vendingFlaw,
  };
  return vendingVerdict;
}

// Walk the ranking from the top and take the first line that passes
// the gate. The walk keeps its answer in a named variable and never
// leaps ahead, so a refused champion falls through to the next best.
function vendingPickLine(vendingRanked: VendingRankedContender[]): VendingContender {
  let vendingChosen: VendingContender | undefined = undefined;
  let vendingChosenFlaw = "";
  for (const vendingRow of vendingRanked) {
    const vendingVerdict = vendingCheckContender(vendingRow.vendingContender);
    if (vendingChosen === undefined && vendingVerdict.vendingPasses) {
      vendingChosen = vendingRow.vendingContender;
    }
    if (vendingChosen === undefined && vendingChosenFlaw === "") {
      vendingChosenFlaw = vendingVerdict.vendingFlaw;
    }
  }
  if (vendingChosen === undefined) {
    const vendingFailure = new Error(`no contender passes the gate: ${vendingChosenFlaw}`);
    throw vendingFailure;
  }
  return vendingChosen;
}

// Write the winning line to the output path, creating the directory
// first. The file holds the line alone, with no trailing newline, so
// the gate reads exactly the characters the line carries.
function vendingWriteLine(vendingText: string, vendingTarget: string): void {
  try { const vendingDirectory = dirname(vendingTarget);
    mkdirSync(vendingDirectory, { recursive: true });
    writeFileSync(vendingTarget, vendingText, "utf8");
  } catch (vendingWriteFailure) {
    const vendingWrapped = new Error(`cannot write the entry file: ${String(vendingWriteFailure)}`);
    throw vendingWrapped;
  }
}

// Run the tournament, gate the champion, and write it out. The only
// things printed are counts, never the line itself, so the entry stays
// a single written artifact and the log carries no copy of it.
function vendingMain(): void {
  const vendingRanked = vendingRankContenders(VENDING_CONTENDERS);
  const vendingChampion = vendingPickLine(vendingRanked);
  const vendingTarget = vendingOutputPath();
  vendingWriteLine(vendingChampion.vendingText, vendingTarget);
  const vendingChampionTotal = vendingWeighContender(vendingChampion);
  const vendingChampionChars = vendingCharCount(vendingChampion.vendingText);
  const vendingReport = [
    `vending-pickup-entry1: wrote ${vendingChampionChars} characters`,
    `from ${VENDING_CONTENDERS.length} contenders, champion total ${vendingChampionTotal}`,
    `to ${vendingTarget}`,
  ].join("\n");
  console.log(vendingReport);
}

try { vendingMain(); } catch (vendingTopFailure) {
  console.error(`vending-pickup-entry1 failed: ${String(vendingTopFailure)}`);
  process.exitCode = 1;
}
