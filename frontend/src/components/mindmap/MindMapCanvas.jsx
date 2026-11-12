import React, { useRef, useEffect, useState } from 'react';

const MindMapCanvas = ({ mindmap }) => {
  const canvasRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (!mindmap || !canvasRef.current) return;
    
    // Canvas will be handled by SVG rendering
  }, [mindmap]);

  if (!mindmap) {
    return (
      <div className="h-96 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">No mindmap data available</p>
      </div>
    );
  }

  // Convert mindmap structure to drawable nodes
  const getNodes = () => {
    if (mindmap.nodes && mindmap.edges) {
      return mindmap.nodes;
    }
    
    // If mindmap has central_topic and branches structure
    if (mindmap.central_topic && mindmap.branches) {
      const nodes = [];
      const centerX = 500;
      const centerY = 300;
      
      // Central node
      nodes.push({
        id: 'center',
        text: mindmap.central_topic,
        x: centerX,
        y: centerY,
        level: 0
      });
      
      // Branch nodes
      const angleStep = (2 * Math.PI) / mindmap.branches.length;
      mindmap.branches.forEach((branch, i) => {
        const angle = i * angleStep;
        const radius = 200;
        const branchX = centerX + radius * Math.cos(angle);
        const branchY = centerY + radius * Math.sin(angle);
        
        nodes.push({
          id: `branch-${i}`,
          text: branch.topic,
          x: branchX,
          y: branchY,
          level: 1,
          parentId: 'center'
        });
        
        // Subtopics
        if (branch.subtopics && branch.subtopics.length > 0) {
          branch.subtopics.forEach((subtopic, j) => {
            const subAngle = angle + (j - branch.subtopics.length / 2) * 0.3;
            const subRadius = radius + 150;
            const subX = centerX + subRadius * Math.cos(subAngle);
            const subY = centerY + subRadius * Math.sin(subAngle);
            
            nodes.push({
              id: `sub-${i}-${j}`,
              text: typeof subtopic === 'string' ? subtopic : subtopic.text,
              x: subX,
              y: subY,
              level: 2,
              parentId: `branch-${i}`
            });
          });
        }
      });
      
      return nodes;
    }
    
    return [];
  };

  const nodes = getNodes();

  // Get connections between nodes
  const getConnections = () => {
    if (mindmap.edges) {
      return mindmap.edges;
    }
    
    // Create connections from parent relationships
    const connections = [];
    nodes.forEach(node => {
      if (node.parentId) {
        connections.push({
          source: node.parentId,
          target: node.id
        });
      }
    });
    
    return connections;
  };

  const connections = getConnections();

  const getNodeColor = (level) => {
    switch (level) {
      case 0: return '#3B82F6'; // blue-500
      case 1: return '#8B5CF6'; // purple-500
      case 2: return '#EC4899'; // pink-500
      default: return '#6B7280'; // gray-500
    }
  };

  const handleNodeClick = (node) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
  };

  return (
    <div className="relative">
      <svg 
        ref={canvasRef}
        className="w-full border-2 border-gray-200 rounded-lg bg-white"
        viewBox="0 0 1000 600"
        style={{ minHeight: '500px' }}
      >
        {/* Draw connections first (so they appear behind nodes) */}
        {connections.map((conn, idx) => {
          const sourceNode = nodes.find(n => n.id === conn.source);
          const targetNode = nodes.find(n => n.id === conn.target);
          
          if (!sourceNode || !targetNode) return null;
          
          return (
            <line
              key={idx}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke="#D1D5DB"
              strokeWidth="2"
              className="transition-all"
            />
          );
        })}
        
        {/* Draw nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNode?.id === node.id;
          const nodeColor = getNodeColor(node.level);
          const fontSize = node.level === 0 ? 18 : node.level === 1 ? 14 : 12;
          const radius = node.level === 0 ? 60 : node.level === 1 ? 50 : 40;
          
          return (
            <g 
              key={node.id}
              className="cursor-pointer transition-transform hover:scale-110"
              onClick={() => handleNodeClick(node)}
            >
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={isSelected ? nodeColor : 'white'}
                stroke={nodeColor}
                strokeWidth={isSelected ? 4 : 3}
                className="transition-all"
              />
              
              {/* Node text */}
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isSelected ? 'white' : nodeColor}
                fontSize={fontSize}
                fontWeight="600"
                className="pointer-events-none select-none"
              >
                {node.text.length > 20 ? node.text.substring(0, 18) + '...' : node.text}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Selected node details */}
      {selectedNode && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-1">
            {selectedNode.text}
          </h4>
          <p className="text-sm text-blue-700">
            Level: {selectedNode.level === 0 ? 'Central Topic' : selectedNode.level === 1 ? 'Main Branch' : 'Subtopic'}
          </p>
        </div>
      )}
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span className="text-gray-600">Central Topic</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-purple-500"></div>
          <span className="text-gray-600">Main Branches</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-pink-500"></div>
          <span className="text-gray-600">Subtopics</span>
        </div>
      </div>
    </div>
  );
};

export default MindMapCanvas;
