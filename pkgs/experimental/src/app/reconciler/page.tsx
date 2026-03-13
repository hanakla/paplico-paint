"use client";

import React, { useEffect, useRef, useState } from "react";
import {
	addArtObjectToDocument,
	addLayerToDocument,
	createDocument,
	createPathArtObject,
	createVectorLayer,
	type Document,
} from "@/engine/document";
import { createSolidFill } from "@/engine/document/appearance";
import {
	mountWebGPUReconciler,
	unmountWebGPUContainer,
	updateWebGPUContainer,
	type WebGPUContainer,
} from "./webgpu-reconciler";

// Component definitions for WebGPU document structure

const WebGPUDocumentComponent: React.FC<{
	name?: string;
	children: React.ReactNode;
}> = ({ name, children }) => {
	return React.createElement("document", { name }, children);
};

const WebGPULayerComponent: React.FC<{
	name?: string;
	visible?: boolean;
	opacity?: number;
	children: React.ReactNode;
}> = ({ name, visible, opacity, children }) => {
	return React.createElement("layer", { name, visible, opacity }, children);
};

const WebGPUArtObjectComponent: React.FC<{
	name?: string;
	x?: number;
	y?: number;
	color?: { r: number; g: number; b: number; a: number };
	path?: any;
}> = ({ name, x, y, color, path }) => {
	return React.createElement("artObject", { name, x, y, color, path });
};

export default function ReconcilerExample() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [reconcilerContainer, setReconcilerContainer] =
		useState<WebGPUContainer | null>(null);
	const [position, setPosition] = useState({ x: 100, y: 100 });

	// Initialize WebGPU reconciler
	useEffect(() => {
		if (!canvasRef.current) return;

		mountWebGPUReconciler(canvasRef.current)
			.then(({ container }) => {
				setReconcilerContainer(container);
				// Initial render
				updateWebGPUContainer(<SampleDocumentComponent />, container);
			})
			.catch((error) => {
				console.error("Failed to initialize WebGPU:", error);
			});

		return () => {
			// Cleanup is handled in a separate effect
		};
	}, []);

	// Separate cleanup effect
	useEffect(() => {
		return () => {
			if (reconcilerContainer) {
				unmountWebGPUContainer(reconcilerContainer);
			}
		};
	}, [reconcilerContainer]);

	const moveObject = () => {
		setPosition((prev) => ({
			x: prev.x + 50,
			y: prev.y + 20,
		}));

		// Update with new position
		if (reconcilerContainer) {
			updateWebGPUContainer(
				<WebGPUDocumentComponent name="Sample Document">
					<WebGPULayerComponent name="Main Layer" visible={true} opacity={1}>
						<WebGPUArtObjectComponent
							name="Moving Rectangle"
							x={position.x + 50}
							y={position.y + 20}
							color={{ r: 1, g: 0.5, b: 0, a: 1 }}
						/>
					</WebGPULayerComponent>
				</WebGPUDocumentComponent>,
				reconcilerContainer,
			);
		}
	};

	return (
		<div className="p-4">
			<h1 className="text-2xl font-bold mb-4">
				React Reconciler + WebGPU サンプル
			</h1>

			<div className="mb-4 space-x-2">
				<button
					type="button"
					onClick={moveObject}
					className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
				>
					オブジェクトを移動
				</button>
			</div>

			<div className="mb-4">
				<canvas
					ref={canvasRef}
					width={800}
					height={600}
					className="border border-gray-300"
				/>
			</div>
		</div>
	);
}

// サンプルドキュメント作成関数
function createSampleDocument(): Document {
	const doc = createDocument({ name: "Sample Document" });

	// レイヤー作成
	const layer1 = createVectorLayer({ name: "Background Layer" });
	const layer2 = createVectorLayer({ name: "Shapes Layer" });

	addLayerToDocument(doc, layer1);
	addLayerToDocument(doc, layer2);

	// アートオブジェクト作成
	const rect = createPathArtObject({
		name: "Rectangle",
		layerId: layer1.id,
		x: 50,
		y: 50,
		path: {
			points: [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 60 },
				{ x: 0, y: 60 },
			],
			closed: true,
		},
		appearances: [createSolidFill({ color: { r: 0, g: 0.5, b: 1, a: 1 } })],
	});

	const circle = createPathArtObject({
		name: "Circle",
		layerId: layer2.id,
		x: 200,
		y: 100,
		path: {
			points: Array.from({ length: 32 }, (_, i) => {
				const angle = (i / 32) * Math.PI * 2;
				const radius = 40;
				return {
					x: Math.cos(angle) * radius,
					y: Math.sin(angle) * radius,
				};
			}),
			closed: true,
		},
		appearances: [createSolidFill({ color: { r: 1, g: 0.3, b: 0.3, a: 0.8 } })],
	});

	addArtObjectToDocument(doc, rect);
	addArtObjectToDocument(doc, circle);

	return doc;
}

// コンポーネント版サンプル
function SampleDocumentComponent() {
	return (
		<WebGPUDocumentComponent name="Component Sample">
			<WebGPULayerComponent name="Background" visible={true} opacity={1}>
				<WebGPUArtObjectComponent
					name="Blue Rectangle"
					x={50}
					y={50}
					color={{ r: 0, g: 0.5, b: 1, a: 1 }}
				/>
			</WebGPULayerComponent>
			<WebGPULayerComponent name="Foreground" visible={true} opacity={0.8}>
				<WebGPUArtObjectComponent
					name="Red Circle"
					x={200}
					y={100}
					color={{ r: 1, g: 0.3, b: 0.3, a: 0.8 }}
				/>
			</WebGPULayerComponent>
		</WebGPUDocumentComponent>
	);
}
