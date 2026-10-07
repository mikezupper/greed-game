import './styles/main.css';
import { GreedTable } from './app/greed-table.ts';
import { provideController } from './app/drivers.ts';
import { Controller } from './state/controller.ts';
import { attachAudio } from './app/audio.ts';

const root = document.querySelector('#game');
if (root) {
  void import('./rendering/dice-tray.ts');
  const controller = new Controller();
  const stopAudio = attachAudio();
  const dispose = provideController(root, controller);
  root.append(new GreedTable());
  if (import.meta.hot) import.meta.hot.dispose(() => { stopAudio(); dispose(); controller.close(); root.replaceChildren(); });
}
