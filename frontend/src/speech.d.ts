interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionResultItem;
}
interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  start(): void;
  addEventListener(type: "result", listener: (event: SpeechRecognitionEvent) => void): void;
  addEventListener(type: "end", listener: () => void): void;
}
interface Window {
  SpeechRecognition?: { new (): SpeechRecognition };
  webkitSpeechRecognition?: { new (): SpeechRecognition };
}
