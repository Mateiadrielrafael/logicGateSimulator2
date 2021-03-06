import { Gate, PinWrapper } from '../../simulation/classes/Gate'
import {
    TransformState,
    CameraState,
    SimulationState
} from '../types/SimulationSave'
import { Transform } from '../../../common/math/classes/Transform'
import { Camera } from '../../simulationRenderer/classes/Camera'
import { Simulation, SimulationEnv } from '../../simulation/classes/Simulation'
import { Wire } from '../../simulation/classes/Wire'
import { templateStore } from '../stores/templateStore'
import { calculateGateHeight } from '../../simulationRenderer/helpers/calculateGateHeight'
import { getRendererSafely } from '../../logic-gates/helpers/getRendererSafely'
import { rendererSubject } from '../../core/subjects/rendererSubject'
import { filter, take } from 'rxjs/operators'
import { vector2 } from '../../../common/math/types/vector2'

/**
 * Contains methods for transforming saved state into the respective class instances
 */

export const fromTransformState = (state: TransformState): Transform => {
    return new Transform(state.position, state.scale, state.rotation)
}

export const fromCameraState = (state: CameraState): Camera => {
    const camera = new Camera()

    camera.transform = fromTransformState(state.transform)

    return camera
}

export const fromSimulationState = (
    state: SimulationState,
    env: SimulationEnv = 'global'
): Simulation => {
    const simulation = new Simulation(state.mode, state.name, env)

    for (const gateState of state.gates) {
        const gate = new Gate(
            templateStore.get(gateState.template),
            gateState.id,
            gateState.props
        )

        gate.transform = fromTransformState(gateState.transform)

        const fixWrongHeight = () => {
            gate.transform.scale = [...Array(2)].fill(
                calculateGateHeight(getRendererSafely(), gate)
            ) as vector2
        }

        try {
            fixWrongHeight()
        } catch {
            // retry if an error occured
            rendererSubject
                .pipe(
                    filter(x => !!x),
                    take(1)
                )
                .subscribe(() => {
                    if (gate) {
                        fixWrongHeight()
                    }
                })
        } finally {
            simulation.push(gate)
        }
    }

    for (const wireState of state.wires) {
        const startGateNode = simulation.gates.get(wireState.from.id)
        const endGateNode = simulation.gates.get(wireState.to.id)

        if (
            startGateNode &&
            endGateNode &&
            startGateNode.data &&
            endGateNode.data
        ) {
            const start: PinWrapper = {
                index: wireState.from.index,
                total: wireState.from.total,
                value: startGateNode.data._pins.outputs[wireState.from.index]
            }
            const end: PinWrapper = {
                index: wireState.to.index,
                total: wireState.to.total,
                value: endGateNode.data._pins.inputs[wireState.to.index]
            }

            const wire = new Wire(start, end, false, wireState.id)

            simulation.wires.push(wire)
        }
    }

    return simulation
}
