# vending-pickup-entry1

make.fun entry for **One Line, One Minute: The Vending Machine Pickup Line Contest**
(`u-brisk-kestrel-93-one-line-one-minute-the-vending-376bbeee`).

## What it does

`main.ts` runs a small deterministic tournament: six original pickup
lines, each spoken by the vending machine itself, are weighed on the
four things the house judge weighs, in the judge's own order — the
machine's voice, the machine's world (slot, buttons, coils, snacks,
hum, exact change), the closing laugh landing in the last few words,
and short, speakable charm. The champion is gated (1–200 characters,
single line, not only white space, carrying a machine-world word and
ending on its own closing punch) and written to `/output/entry.txt`.

## Run

```sh
node main.ts
```

Nothing is random, nothing reads the clock, nothing touches the
network. Two runs produce byte-identical output.
