import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';
import { X, Brain, Zap, Activity, Database, Globe, Shield, Cpu, ExternalLink, RefreshCw, Terminal, Sparkle } from 'lucide-react';
import * as d3 from 'd3-force';

interface NodeData extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  content: string;
  type: 'core' | 'identity' | 'vision' | 'technical' | 'evolution' | 'roadmap' | 'knowledge' | 'protocol' | 'infrastructure' | 'project' | 'live';
  clusterId: string;
  pulseFreq: number;
  isNew?: boolean;
}

interface LinkData extends d3.SimulationLinkDatum<NodeData> {
  source: string | NodeData;
  target: string | NodeData;
  strength: number;
}

const TypewriterText: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText('');
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(prev => prev + text.charAt(i));
          i++;
        } else {
          clearInterval(interval);
        }
      }, 10);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <div className="relative font-mono leading-relaxed group">
      <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase text-xs">{displayedText}</span>
      {displayedText.length < text.length && (
        <span className="inline-block w-2 h-4 bg-gold ml-1 animate-pulse" />
      )}
    </div>
  );
};

export const SecondBrainView: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useSpring(0, { stiffness: 40, damping: 25 });
  const mouseY = useSpring(0, { stiffness: 40, damping: 25 });
  
  const rotateX = useTransform(mouseY, [-500, 500], [7, -7]);
  const rotateY = useTransform(mouseX, [-500, 500], [-7, 7]);
  const translateX = useTransform(mouseX, [-500, 500], [-15, 15]);
  const translateY = useTransform(mouseY, [-500, 500], [-15, 15]);

  const [simulationNodes, setSimulationNodes] = useState<NodeData[]>([]);
  const [simulationLinks, setSimulationLinks] = useState<LinkData[]>([]);
  const [totalNodes, setTotalNodes] = useState(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const simulationRef = useRef<d3.Simulation<NodeData, LinkData> | null>(null);

  const fetchBrainData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/second-brain');
      const data = await res.json();
      setContent(data.content);
    } catch (err) {
      console.error('Failed to load second brain:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBrainData();
    // Auto-refresh every 60 seconds to pull in new chat logs
    const interval = setInterval(fetchBrainData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const { nodes, links } = useMemo(() => {
    if (!content) return { nodes: [], links: [] };

    const lines = content.split('\n');
    const parsedNodes: NodeData[] = [];
    const parsedLinks: LinkData[] = [];
    let currentNode: Partial<NodeData> | null = null;
    let sectionStack: string[] = [];

    // 1. Parse Nodes with Unique ID Logic
    lines.forEach((line) => {
      const headerMatch = line.match(/^(#+)\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const originalLabel = headerMatch[2].trim();
        
        // Mantain a section stack for unique ID context
        sectionStack = sectionStack.slice(0, level - 1);
        sectionStack.push(originalLabel);
        
        // Unique ID based on hierarchy path
        let id = sectionStack.join(' > ').replace(/[^\w\s]/gi, '').replace(/\s+/g, '-').toLowerCase();
        
        // Ensure uniqueness
        let idAttempt = id;
        let counter = 1;
        while (parsedNodes.some(n => n.id === idAttempt)) {
          idAttempt = `${id}-${counter}`;
          counter++;
        }
        id = idAttempt;
        
        let type: NodeData['type'] = 'knowledge';
        let label = originalLabel;

        const topSection = sectionStack[0] || '';

        if (label.includes('Amara') || label.includes('Core')) {
          type = 'core';
          label = "Khittara AI Core";
        }
        else if (topSection.includes('၁။')) type = 'identity';
        else if (topSection.includes('၂။')) type = 'vision';
        else if (topSection.includes('၃။')) type = 'technical';
        else if (topSection.includes('၇။') || topSection.includes('၄။')) type = 'evolution';
        else if (topSection.includes('၅။')) type = 'roadmap';
        else if (topSection.includes('၉။')) type = 'live';
        else if (label.includes('Protocol') || label.includes('Interface')) type = 'protocol';
        else if (label.includes('Infrastructure') || label.includes('Technical')) type = 'infrastructure';
        else if (label.includes('Project') || label.includes('Milestones')) type = 'project';

        // Count occurrences for importance
        const mentionCount = (content.match(new RegExp(label, 'gi')) || []).length;
        const pulseFreq = 1.5 + (Math.random() * 2) / (mentionCount || 1);

        // Check if node is new
        const isNew = !knownIdsRef.current.has(id);
        if (isNew && knownIdsRef.current.size > 0) {
          // Only mark as new if it's not the initial load of everything
        }

        currentNode = { id, label, content: '', type, clusterId: type, pulseFreq, isNew };
        parsedNodes.push(currentNode as NodeData);
      } else if (line.trim().startsWith('*   **Neural Node')) {
        // Parse list items as specific nodes
        const itemLabel = line.replace(/^\*\s+\*\*/, '').split('**')[0].trim();
        const id = `neural-node-${itemLabel.replace(/[^\w\s]/gi, '').replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`;
        parsedNodes.push({
          id,
          label: itemLabel,
          content: line,
          type: 'live',
          clusterId: 'live',
          pulseFreq: 3,
          isNew: true
        });
      } else if (currentNode) {
        currentNode.content += line + '\n';
      }
    });

    // Update known IDs
    parsedNodes.forEach(n => knownIdsRef.current.add(n.id));

    // 2. Initial Layout (d3 handles the rest)
    const VIEWBOX_SIZE = 1200;
    const CENTER = VIEWBOX_SIZE / 2;
    parsedNodes.forEach((node, i) => {
      if (node.type === 'core') {
        node.x = CENTER;
        node.y = CENTER;
        node.fx = CENTER; // Pin core
        node.fy = CENTER;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 200;
        node.x = CENTER + Math.cos(angle) * dist;
        node.y = CENTER + Math.sin(angle) * dist;
      }
    });

    // 3. Intelligent Linking
    const keywords = ['firebase', 'gemini', 'blockchain', 'infrastructure', 'ai', 'protocol', 'neural', 'automation', 'interface', 'arindama', 'ka-laung', 'hydra', 'orchid'];
    const hubs = {
      projects: parsedNodes.find(n => n.label.toLowerCase().includes('active projects') || n.label.toLowerCase().includes('plans')),
      agents: parsedNodes.find(n => n.label.toLowerCase().includes('identity') || n.label.toLowerCase().includes('amara')),
      core: parsedNodes.find(n => n.type === 'core')
    };

    parsedNodes.forEach((node, i) => {
      if (hubs.core && node.id !== hubs.core.id) {
        parsedLinks.push({ source: hubs.core.id, target: node.id, strength: 1 });
      }
      if (node.type === 'project' && hubs.projects && node.id !== hubs.projects.id) {
        parsedLinks.push({ source: hubs.projects.id, target: node.id, strength: 0.8 });
      }
      keywords.forEach(kw => {
        if (node.content.toLowerCase().includes(kw) || node.label.toLowerCase().includes(kw)) {
          parsedNodes.slice(i + 1).forEach(otherNode => {
            if (otherNode.content.toLowerCase().includes(kw) || otherNode.label.toLowerCase().includes(kw)) {
              if (!parsedLinks.find(l => (l.source === node.id && l.target === otherNode.id) || (l.target === node.id && l.source === otherNode.id))) {
                parsedLinks.push({ source: node.id, target: otherNode.id, strength: 0.5 });
              }
            }
          });
        }
      });
    });

    return { nodes: parsedNodes, links: parsedLinks };
  }, [content]);

  // Setup D3 Simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simNodes = nodes.map(n => ({ ...n }));
    const simLinks = links.map(l => ({ 
      ...l, 
      source: simNodes.find(sn => sn.id === (typeof l.source === 'string' ? l.source : l.source.id))!,
      target: simNodes.find(sn => sn.id === (typeof l.target === 'string' ? l.target : l.target.id))!
    }));

    const simulation = d3.forceSimulation<NodeData>(simNodes)
      .force("link", d3.forceLink<NodeData, LinkData>(simLinks).id(d => d.id).distance(150).strength(d => d.strength))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(600, 600))
      .force("collision", d3.forceCollide().radius(80))
      .on("tick", () => {
        setSimulationNodes([...simNodes]);
        setSimulationLinks([...simLinks]);
      });

    simulationRef.current = simulation;
    setTotalNodes(simNodes.length);

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  const getNodeIcon = (type: NodeData['type']) => {
    switch(type) {
      case 'core': return <Brain size={24} />;
      case 'protocol': return <Zap size={20} />;
      case 'infrastructure': return <Database size={20} />;
      case 'project': return <Globe size={20} />;
      case 'live': return <Activity size={20} className="animate-pulse" />;
      default: return <Activity size={20} />;
    }
  };

  const getNodeColor = (type: NodeData['type']) => {
    switch(type) {
      case 'core': return '#FFD700'; // Neon Gold
      case 'identity': return '#FFD700'; // Neon Gold
      case 'vision': return '#FF00FF'; // Electric Magenta
      case 'technical': return '#00FFFF'; // Cyber Blue
      case 'evolution': return '#FF8C00'; // Vibrant Orange
      case 'roadmap': return '#50C878'; // Emerald Green
      case 'protocol': return '#00f2ff'; // Electric Blue
      case 'infrastructure': return '#a855f7'; // Deep Purple
      case 'project': return '#ff00ff'; // Intense Magenta
      case 'live': return '#00ffcc'; // Vibrant Teal/Cyan
      default: return '#3b82f6'; // Bright Blue
    }
  };

  const Heartbeat = {
    scale: [0.98, 1.02, 0.98],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#020617] text-gold">
        <div className="scale-150 relative">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-20 h-20 border-t-2 border-gold rounded-full opacity-30" />
          <motion.div animate={{ rotate: -360 }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} className="absolute inset-0 w-20 h-20 border-b-2 border-cyan-400 rounded-full opacity-30" />
          <Brain className="absolute inset-0 m-auto animate-pulse text-gold shadow-[0_0_20px_rgba(255,215,0,0.5)]" size={32} />
        </div>
        <p className="mt-12 text-xs font-black tracking-[0.5em] uppercase animate-pulse">Neural Sync in Progress</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      onMouseMove={handleMouseMove}
      className="relative w-full h-full bg-[#020617] overflow-hidden flex items-center justify-center cursor-crosshair"
      style={{ perspective: '1200px' }}
    >
      {/* Background Deep Space */}
      <div className="absolute inset-0 bg-[#020617]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(58,12,163,0.15)_0%,rgba(2,6,23,1)_100%)]" />
      
      {/* Neural Noise / Flickering Background activity */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={`noise-${i}`}
            className="absolute h-[1px] bg-gold/50"
            style={{
              top: `${Math.random() * 100}%`,
              left: 0,
              width: '100%',
              transform: `rotate(${Math.random() * 2 - 1}deg)`
            }}
            animate={{
              opacity: [0, 0.5, 0],
              x: [-10, 10, -10]
            }}
            transition={{
              duration: 0.1 + Math.random() * 0.2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>
      
      {/* Background Starfield / Neural Fuzz */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(120)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${Math.random() > 0.5 ? 'bg-gold/30' : 'bg-cyan-400/20'}`}
            initial={{ 
              x: Math.random() * 2000 - 400, 
              y: Math.random() * 2000 - 400, 
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              opacity: Math.random() * 0.3 
            }}
            animate={{ 
              opacity: [0.1, 0.4, 0.1],
              scale: [1, 1.2, 1],
            }}
            transition={{ 
              duration: 4 + Math.random() * 5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
        ))}
      </div>

      {/* Title & Controls Overlay */}
      <div className="absolute top-10 left-10 z-30 pointer-events-none group">
        <div className="flex items-center gap-6 p-4 bg-black/40 backdrop-blur-2xl border border-white/5 rounded-2xl">
          <div className="relative">
            <div className="absolute inset-0 bg-gold/20 blur-xl rounded-full" />
            <div className="relative p-4 bg-gold/10 rounded-xl border border-gold/40">
              <Shield className="text-gold" size={28} />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
              Neural Matrix
              <span className="text-[10px] bg-red-600/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded-md font-mono animate-pulse">LIVE</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-[0.4em] uppercase">Khittara Protocol v4.0.2</p>
          </div>
        </div>
      </div>

      <div className="absolute top-10 right-10 z-30 flex gap-4 pointer-events-auto">
        <button 
          onClick={fetchBrainData}
          className="p-4 bg-black/40 hover:bg-gold/20 backdrop-blur-md rounded-2xl border border-white/10 transition-all group flex items-center gap-3"
        >
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] group-hover:text-gold transition-colors">Resync Brain</span>
          <RefreshCw size={20} className={refreshing ? 'animate-spin text-gold' : 'group-hover:rotate-180 transition-transform duration-700 text-zinc-500 group-hover:text-gold'} />
        </button>
      </div>

      {/* SVG Container with 3D Transform and Heartbeat */}
      <motion.div 
        className="w-full h-full p-24"
        animate={{
          x: selectedNode ? -150 : 0,
          scale: selectedNode ? 0.7 : [0.88, 0.92, 0.88]
        }}
        style={{ 
          rotateX,
          rotateY,
          x: translateX,
          y: translateY,
          transformStyle: 'preserve-3d',
        }}
        transition={{ 
          x: { duration: 1, ease: [0.23, 1, 0.32, 1] },
          scale: selectedNode ? { duration: 1 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <svg viewBox="0 0 1200 1200" className="w-full h-full preserve-3d overflow-visible">
          <defs>
            <linearGradient id="linkGradient" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255,215,0,0.1)" />
              <stop offset="50%" stopColor="rgba(255,215,0,0.4)" />
              <stop offset="100%" stopColor="rgba(255,215,0,0.1)" />
            </linearGradient>
            <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="neon-strong" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="25" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

            {/* Neural Filaments - Bundle thicker lines for main connections */}
            {simulationLinks.map((link, i) => {
              const s = link.source as NodeData;
              const t = link.target as NodeData;
              if (!s || !t || s.x === undefined || t.x === undefined) return null;

              const linkId = `${s.id}-${t.id}`;
              const isMainArtery = s.type === 'core' || t.type === 'core';
              const midX = (s.x + t.x) / 2;
              const midY = (s.y + t.y) / 2;
              const dist = Math.sqrt(Math.pow(t.x - s.x, 2) + Math.pow(t.y - s.y, 2));
              const ctrlOffset = dist * (isMainArtery ? 0.1 : 0.25);
              const ctrlX = midX + (Math.random() - 0.5) * 0.1; // Reduced randomness for simulation stability
              const ctrlY = midY + (Math.random() - 0.5) * 0.1;
              const path = `M ${s.x} ${s.y} Q ${ctrlX} ${ctrlY} ${t.x} ${t.y}`;

              const isRelated = hoveredNode === s.id || hoveredNode === t.id;
              const linkColor = isRelated ? getNodeColor(s.type) : (isMainArtery ? "rgba(255,215,0,0.15)" : "rgba(148,163,184,0.05)");

              return (
                <g key={`link-${linkId}-${i}`} className="transition-opacity duration-700" style={{ opacity: hoveredNode && !isRelated ? 0.05 : 1 }}>
                  {/* Subtle bundle effect for main arteries */}
                  {isMainArtery && (
                    <path
                      d={path}
                      fill="none"
                      stroke={linkColor}
                      strokeWidth={isRelated ? 4 : 2}
                      strokeOpacity="0.03"
                      className="transition-all duration-500"
                    />
                  )}
                  
                  <path
                    d={path}
                    fill="none"
                    stroke={linkColor}
                    strokeWidth={isRelated ? 1.5 : (isMainArtery ? 0.8 : 0.4)}
                    strokeDasharray={isRelated ? "none" : (isMainArtery ? "" : "8,12")}
                    strokeOpacity={isRelated ? 0.8 : 0.5}
                    className="transition-all duration-500"
                  />
                  
                  {/* Data Flow */}
                  <motion.g style={{ display: (isRelated || Math.random() > 0.6) ? 'block' : 'none' }}>
                    {[1, (isMainArtery ? 2 : 0)].filter(v => v !== 0).map(packetId => (
                      <motion.circle 
                        key={packetId}
                        r={isRelated ? 3.5 : (isMainArtery ? 2.5 : 1.5)} 
                        fill={isRelated ? getNodeColor(s.type) : (isMainArtery ? "#FFD700" : "white")} 
                        filter="url(#neon)"
                      >
                        <animateMotion 
                          dur={`${1 + Math.random() * 2}s`} 
                          repeatCount="indefinite" 
                          path={path} 
                          begin={`${packetId * 0.5}s`}
                        />
                      </motion.circle>
                    ))}
                  </motion.g>
                </g>
              );
            })}

          {/* Core Pulse Rings */}
          {simulationNodes.filter(n => n.type === 'core').map((core, i) => (
            <g key={`core-rings-${core.id}-${i}`}>
              {[1, 2, 3].map(j => (
                <motion.circle
                  key={j}
                  cx={core.x}
                  cy={core.y}
                  r="60"
                  fill="none"
                  stroke={getNodeColor('core')}
                  strokeWidth="0.5"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 4, opacity: 0 }}
                  transition={{ duration: 4, repeat: Infinity, delay: j * 1.3, ease: "linear" }}
                />
              ))}
            </g>
          ))}

          {/* Nodes */}
          {simulationNodes.map((node) => (
            <motion.g
              key={node.id}
              className="cursor-grab active:cursor-grabbing group"
              drag
              dragMomentum={false}
              onDragStart={() => {
                node.fx = node.x;
                node.fy = node.y;
              }}
              onDrag={(e, info) => {
                node.fx = node.x + info.delta.x;
                node.fy = node.y + info.delta.y;
                if (simulationRef.current) simulationRef.current.alpha(1).restart();
              }}
              onDragEnd={() => {
                if (node.type !== 'core') {
                  node.fx = null;
                  node.fy = null;
                }
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(node)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                x: node.x,
                y: node.y,
                scale: 1, 
                opacity: hoveredNode && hoveredNode !== node.id && !simulationLinks.some(l => {
                  const s = l.source as NodeData;
                  const t = l.target as NodeData;
                  return (s.id === node.id && t.id === hoveredNode) || (t.id === node.id && s.id === hoveredNode);
                }) ? 0.3 : 1,
              }}
              whileHover={{ scale: 1.2 }}
            >
              {/* Sparkle for new nodes */}
              {node.isNew && (
                <motion.circle
                  r="30"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  animate={{ rotate: 360, opacity: [0, 0.5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              )}

              {/* Node Outer Glow */}
              <circle
                r={node.type === 'core' ? 40 : (node.type === 'live' ? 30 : 20)}
                fill={getNodeColor(node.type)}
                fillOpacity={node.type === 'live' ? '0.2' : '0.05'}
                filter="url(#neon-strong)"
              />
              
              {/* Main Node Shape with custom pulse freq */}
              <motion.circle
                r={node.type === 'core' ? 14 : 7}
                fill={getNodeColor(node.type)}
                filter="url(#neon)"
                animate={node.isNew ? {
                  r: [7, 12, 7],
                  fill: ['#ffffff', getNodeColor(node.type), '#ffffff'],
                  fillOpacity: [0.8, 1, 0.8]
                } : (node.type === 'live' ? {
                  r: [7, 11, 7],
                  fillOpacity: [0.8, 1, 0.8],
                  stroke: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)'],
                  strokeWidth: [0, 2, 0]
                } : {
                  r: node.type === 'core' ? [14, 18, 14] : [7, 9, 7],
                  fillOpacity: [0.8, 1, 0.8]
                })}
                transition={{ 
                  duration: node.isNew ? 0.5 : (node.type === 'live' ? 1 : (node.pulseFreq || 2)), 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* Data Orbitals for core */}
              {node.type === 'core' && (
                <motion.g animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
                  <circle cx="35" cy="0" r="3" fill="#00f2ff" filter="url(#neon)" />
                  <circle cx="-35" cy="0" r="3" fill="#a855f7" filter="url(#neon)" />
                </motion.g>
              )}

              {/* Label Component */}
              <g transform={`translate(0, ${(node.type === 'core' ? 65 : 45)})`}>
                <rect 
                  x="-60" y="-12" width="120" height="24" 
                  fill="rgba(0,0,0,0.8)" 
                  rx="6" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  stroke={getNodeColor(node.type)}
                  strokeWidth="0.5"
                />
                <text
                  textAnchor="middle"
                  fill="white"
                  fontSize={node.type === 'core' ? "18" : "11"}
                  fontWeight="900"
                  className="uppercase tracking-[0.2em] font-sans pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
                >
                  {node.label}
                </text>
              </g>
            </motion.g>
          ))}
        </svg>
      </motion.div>

      {/* Cyberpunk Detailed Sidebar */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: '100%', skewX: 5 }}
            animate={{ x: 0, skewX: 0 }}
            exit={{ x: '100%', skewX: -5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 100 }}
            className="absolute top-0 right-0 w-[550px] h-full z-50 p-16 flex flex-col overflow-hidden"
          >
            {/* Panel Background with Glassmorphism */}
            <div className="absolute inset-0 bg-[#050a14]/90 backdrop-blur-[80px] border-l-2 border-gold/30 shadow-[-40px_0_100px_rgba(0,0,0,0.9)]" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
            
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex justify-between items-start mb-12">
                <div className="flex items-center gap-3 py-1 px-3 bg-gold/10 border border-gold/30 rounded-md text-[9px] font-black tracking-widest text-gold uppercase">
                  <Terminal size={12} />
                  Memory Segment v{selectedNode.id.substring(0, 4)}: Stable
                </div>
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white hover:border-gold/50 transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mb-10">
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gold/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative p-6 rounded-2xl bg-black border-2 border-gold/40 shadow-[0_0_30px_rgba(255,215,0,0.2)]">
                      <div style={{ color: getNodeColor(selectedNode.type) }}>
                        {getNodeIcon(selectedNode.type)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-2">
                      {selectedNode.label.split(' ').map((word, i) => (
                        <span key={i} className={i % 2 === 1 ? 'text-gold' : ''}>{word} </span>
                      ))}
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(b => (
                          <div key={b} className={`w-1.5 h-1.5 rounded-full ${b < 4 ? 'bg-gold' : 'bg-zinc-800'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Integrity Verified</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Cluster', val: selectedNode.type.toUpperCase(), icon: <Activity size={12} /> },
                    { label: 'Latency', val: '0.002ms', icon: <Zap size={12} /> }
                  ].map((item, i) => (
                    <div key={i} className="bg-white/5 p-4 border border-white/5 rounded-xl flex items-center gap-4">
                      <div className="text-gold opacity-50">{item.icon}</div>
                      <div>
                        <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">{item.label}</p>
                        <p className="text-xs text-white font-bold">{item.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-6">
                <div className="space-y-8 pb-12">
                  {selectedNode.content.split('\n').filter(l => l.trim()).map((para, i) => (
                    <div key={`${selectedNode.id}-${i}`} className="relative pl-6">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gold/20 rounded-full overflow-hidden">
                        <motion.div 
                          className="w-full bg-gold"
                          initial={{ height: 0 }}
                          animate={{ height: '100%' }}
                          transition={{ duration: 1.5, delay: i * 0.2 }}
                        />
                      </div>
                      <TypewriterText text={para} delay={i * 300} />
                    </div>
                  ))}
                  {selectedNode.content.trim() === '' && (
                    <div className="flex flex-col items-center justify-center h-48 opacity-20">
                      <Cpu size={48} className="animate-spin text-zinc-600 mb-4" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting Data Stream...</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 space-y-4">
                <button className="w-full py-6 bg-gold hover:bg-white text-black font-black uppercase tracking-[0.5em] text-xs transition-all shadow-[0_0_40px_rgba(255,215,0,0.3)] active:scale-95 transition-colors">
                  Synchronize Data
                </button>
                <div className="flex justify-between items-center px-2">
                  <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Protocol Secured by Arindama</p>
                  <p className="text-[8px] text-gold font-black uppercase tracking-widest animate-pulse">Connection: Secure</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Total Knowledge HUD */}
      <div className="absolute bottom-10 right-10 z-30 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md border border-gold/20 p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-gold flex items-center justify-center">
            <span className="text-xl font-black text-gold">{totalNodes}</span>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active Neural Nodes</p>
            <p className="text-[8px] text-gold/60 font-mono">Sync Status: Optimal</p>
          </div>
        </div>
      </div>

      {/* Grid Lines Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="w-full h-full bg-[linear-gradient(rgba(255,215,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.1)_1px,transparent_1px)] bg-[size:100px_100px]" />
      </div>
      
      {/* HUD Elements */}
      <div className="absolute bottom-10 left-10 z-30 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-1/2 h-full bg-gold/40 shadow-[0_0_10px_gold]" />
          </div>
          <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Neural Load: 12% Optimal</p>
        </div>
      </div>
    </div>
  );
};
