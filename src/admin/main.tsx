import { render } from 'preact';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '../site/styles/base.css';
import '../site/styles/guide.css';
import './admin.css';
import { AdminApp } from './App';

document.body.classList.add('admin');
render(<AdminApp />, document.getElementById('admin')!);
