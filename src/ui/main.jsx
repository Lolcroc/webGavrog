import * as React from 'react';
import * as csp   from 'plexus-csp';

import * as delaney  from '../dsymbols/delaney';
import Display3d from './Display3d';
import Floatable from './Floatable';
import Menu      from './Menu';
import makeScene from './makeScene';


const triangleUp    = '\u25b2';
const triangleRight = '\u25ba';
const triangleDown  = '\u25bc';
const triangleLeft  = '\u25c0';


const tilings = {
  dia: '<1.1:2 3:2,1 2,1 2,2:6,3 2,6>',
  pcu: '<1.1:1 3:1,1,1,1:4,3,4>'
};


const App = React.createClass({
  displayName: 'App',

  getInitialState() {
    return {};
  },

  handleResize(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  },

  log(s) {
    this.setState({ log: s });
  },

  componentDidMount() {
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    csp.go(function*() {
      try {
        const scene = yield makeScene(delaney.parse(tilings.dia), this.log);
        const camera = scene.getObjectByName('camera');
        const cameraParameters = { distance: camera.position.z };

        this.setState({ scene, camera, cameraParameters });
      } catch(ex) { console.error(ex); }
    }.bind(this));
  },

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },

  toggleMenu() {
    this.setState({ showMenu: !this.state.showMenu });
  },

  render3d() {
    if (this.state.scene != null)
      return (
        <Display3d scene            = {this.state.scene}
                   camera           = {this.state.camera}
                   cameraParameters = {this.state.cameraParameters}
                   width            = {this.state.width}
                   height           = {this.state.height}
                   />
      );
  },

  renderTrigger() {
    return (
      <div className="infoBoxTrigger"
           onClick={this.toggleMenu}>
        {this.state.showMenu ? triangleUp : triangleDown}
      </div>
    );
  },

  renderMenu() {
    if (this.state.showMenu)
      return <Menu className="infoBoxMenu"
                   labels={['File', 'Options', 'Help']}/>;
  },

  render() {
    const message = this.state.log || "Welcome!";

    return (
      <div>
        {this.render3d()}
        <Floatable className="infoBox">
          {this.renderTrigger()}
          <img className="infoBoxLogo" src="3dt.ico"/>
          <h3 className="infoBoxHeader">Gavrog</h3>
          <span className="clearFix">{message}</span>
          {this.renderMenu()}
        </Floatable>
      </div>
    );
  }
});


React.render(<App/>, document.getElementById('react-main'));
