import { Archive } from 'libarchive.js';
import { DOMRegistry, UIManager, FileCollection, Unzipper, FileUploader } from '@/services';

Archive.init({ workerUrl: '/worker-bundle.js' });

const dom = new DOMRegistry();
const uiManager = new UIManager(dom);
const fileUploader = new FileUploader(dom, uiManager);
const fileCollection = new FileCollection();
const unzipper = new Unzipper(uiManager, fileCollection);

fileUploader.onExtract(async files => {
  await unzipper.runAsync(files);
});

fileUploader.onReset(() => {
  fileCollection.clear();
  uiManager.showUploadSection();
  fileUploader.updateUI();
});
