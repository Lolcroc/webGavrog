import * as React from 'react';


const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val));


export default React.createClass({
  getInitialState() {
    return {
      posX: 10,
      posY: 10
    };
  },

  handleMouseDown(event) {
    event.preventDefault();

    document.addEventListener('mousemove', this.handleMouseMove, false);
    document.addEventListener('mouseup'  , this.handleMouseUp  , false);

    const element = React.findDOMNode(this);

    this.setState({
      mouseDown: true,
      offsetX: this.state.posX - event.clientX,
      offsetY: this.state.posY - event.clientY,
      maxX   : window.innerWidth  - element.offsetWidth,
      maxY   : window.innerHeight - element.offsetHeight
    });
  },

  handleMouseMove(event) {
    event.preventDefault();

    this.setState({
      posX: clamp(event.clientX + this.state.offsetX, 0, this.state.maxX),
      posY: clamp(event.clientY + this.state.offsetY, 0, this.state.maxY)
    });
  },

  handleMouseUp(event) {
    event.preventDefault();

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup'  , this.handleMouseUp);

    this.setState({
      mouseDown: false
    });
  },

  render() {
    return (
      <div className={`floatable ${this.props.className}`}
           style={{ left  : `${this.state.posX}px`,
                    top   : `${this.state.posY}px`,
                    cursor: this.state.mouseDown ? 'grabbing' : 'grab' }}
           onMouseDown={this.handleMouseDown}>
        {this.props.children}
      </div>
    );
  }
});
