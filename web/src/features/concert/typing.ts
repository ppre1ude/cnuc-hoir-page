const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 한글을 자판으로 치는 순서대로 한 타씩 늘어나는 글자 목록입니다. "가족"은 ㄱ, 가, 가ㅈ, 가조, 가족. 한글이 아닌 글자는 한 번에 칩니다. */
export function typingSteps(word: string): string[] {
  const steps: string[] = [];
  let done = "";
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) {
      steps.push(done + CHO[Math.floor(code / 588)]);
      if (code % 28) steps.push(done + String.fromCharCode(ch.charCodeAt(0) - (code % 28))); // 받침을 치기 전
    }
    done += ch;
    steps.push(done);
  }
  return steps;
}
