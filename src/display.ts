// 文件名、路径与诊断只清洗显示；文件系统操作始终使用原始字符串。
export function displayText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    (char) => `\\u{${char.codePointAt(0)!.toString(16)}}`);
}
