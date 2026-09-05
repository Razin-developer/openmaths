const JSON_ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

/**
 * Incrementally decodes the JSON string value of the "answerMarkdown" field out of a raw
 * token stream, without waiting for the whole envelope object to finish. Assumes the model
 * emits standard JSON string escaping; a malformed/incomplete escape at the tail of a chunk
 * is simply held back until the next feed() call supplies the rest.
 */
export class AnswerMarkdownExtractor {
  private buffer = "";
  private started = false;
  private done = false;

  feed(chunk: string): string {
    if (this.done) return "";
    this.buffer += chunk;

    if (!this.started) {
      const match = /"answerMarkdown"\s*:\s*"/.exec(this.buffer);
      if (!match) return "";
      this.started = true;
      this.buffer = this.buffer.slice(match.index + match[0].length);
    }

    let out = "";
    let i = 0;
    while (i < this.buffer.length) {
      const ch = this.buffer[i];
      if (ch === "\\") {
        const esc = this.buffer[i + 1];
        if (esc === undefined) break;
        if (esc === "u") {
          const hex = this.buffer.slice(i + 2, i + 6);
          if (hex.length < 4) break;
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        out += JSON_ESCAPES[esc] ?? esc;
        i += 2;
        continue;
      }
      if (ch === '"') {
        this.done = true;
        i += 1;
        this.buffer = this.buffer.slice(i);
        return out;
      }
      out += ch;
      i += 1;
    }
    this.buffer = this.buffer.slice(i);
    return out;
  }

  isDone(): boolean {
    return this.done;
  }
}
