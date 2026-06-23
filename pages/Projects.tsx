
import React, { useState, useMemo, useEffect, ReactNode } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell
} from 'recharts';
import { useAppContext } from '../context/AppContext';
import { Project, ProjectStage, ProjectTask, ProjectStatus, ProjectProduct, QualityCriterion, ContactType } from '../types';
import Modal from '../components/Modal';

// --- Sub-component: TaskForm ---
const TaskForm: React.FC<{ task?: ProjectTask; stageId: string; projectId: string; onSave: (task: Omit<ProjectTask, 'id'> | ProjectTask) => void; onCancel: () => void; }> = ({ task, stageId, projectId, onSave, onCancel }) => {
    const { projectTasks } = useAppContext();
    const [name, setName] = useState(task?.name || '');
    const [startDate, setStartDate] = useState(task?.startDate ? task.startDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(task?.endDate ? task.endDate.split('T')[0] : '');
    const [durationDays, setDurationDays] = useState(task?.durationDays || 1);
    const [isCompleted, setIsCompleted] = useState(task?.isCompleted || false);
    const [predecessorTaskId, setPredecessorTaskId] = useState(task?.predecessorTaskId || '');

    const [userInput, setUserInput] = useState<'duration' | 'end_date' | null>(null);

    // Filter available predecessors (exclude current task and tasks from other projects)
    const availablePredecessors = useMemo(() => {
        return projectTasks.filter(t => t.projectId === projectId && t.id !== task?.id);
    }, [projectTasks, projectId, task]);

    // Update Date if predecessor changes
    useEffect(() => {
        if (predecessorTaskId) {
            const pred = projectTasks.find(t => t.id === predecessorTaskId);
            if (pred) {
                const predEnd = new Date(pred.endDate);
                const newStart = new Date(predEnd);
                newStart.setDate(newStart.getDate() + 1); // Start next day
                setStartDate(newStart.toISOString().split('T')[0]);
            }
        }
    }, [predecessorTaskId, projectTasks]);

    useEffect(() => {
        if (userInput !== 'end_date' && startDate && durationDays > 0) {
            const start = new Date(startDate);
            start.setDate(start.getDate() + Number(durationDays));
            setEndDate(start.toISOString().split('T')[0]);
        }
    }, [startDate, durationDays, userInput]);

    useEffect(() => {
        if (userInput !== 'duration' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end >= start) {
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                setDurationDays(diffDays === 0 ? 1 : diffDays);
            }
        }
    }, [startDate, endDate, userInput]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            id: task?.id, 
            name, 
            startDate: new Date(startDate).toISOString(), 
            endDate: new Date(endDate).toISOString(), 
            durationDays, 
            isCompleted, 
            stageId, 
            projectId,
            predecessorTaskId: predecessorTaskId || undefined
        } as ProjectTask);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="taskName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome da Tarefa</label>
                <input type="text" id="taskName" value={name} onChange={e => setName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" required />
            </div>

            <div>
                <label htmlFor="predecessor" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Tarefa Anterior (Dependência)</label>
                <select 
                    id="predecessor" 
                    value={predecessorTaskId} 
                    onChange={e => setPredecessorTaskId(e.target.value)} 
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600"
                >
                    <option value="">Nenhuma</option>
                    {availablePredecessors.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Se selecionado, a data de início será calculada automaticamente.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="startDate" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data de Início</label>
                    <input 
                        type="date" 
                        id="startDate" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                        readOnly={!!predecessorTaskId}
                        className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 ${predecessorTaskId ? 'cursor-not-allowed opacity-70' : ''}`}
                        required 
                    />
                </div>
                <div>
                    <label htmlFor="duration" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Duração (dias)</label>
                    <input type="number" id="duration" value={durationDays} onFocus={() => setUserInput('duration')} onBlur={() => setUserInput(null)} onChange={e => setDurationDays(Number(e.target.value))} min="1" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label htmlFor="endDate" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data Final</label>
                    <input type="date" id="endDate" value={endDate} onFocus={() => setUserInput('end_date')} onBlur={() => setUserInput(null)} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" />
                </div>
            </div>
            <div className="flex items-center">
                <input id="isCompleted" type="checkbox" checked={isCompleted} onChange={e => setIsCompleted(e.target.checked)} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600" />
                <label htmlFor="isCompleted" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">Marcar como concluída</label>
            </div>
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300">Salvar</button>
            </div>
        </form>
    );
}

// --- Sub-component: ProjectStagesView (Kanban) ---
const ProjectStagesView: React.FC<{ project: Project }> = ({ project }) => {
    const { projectStages, projectTasks, updateStage, deleteStage, addStage, addTask, updateTask, deleteTask } = useAppContext();
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<ProjectStage | undefined>(undefined);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined);
    const [currentStageId, setCurrentStageId] = useState('');

    const stages = useMemo(() => projectStages.filter(p => p.projectId === project.id).sort((a, b) => a.order - b.order), [projectStages, project.id]);
    
    // For Stage Form
    const availablePredStages = useMemo(() => {
        return stages.filter(s => s.id !== editingStage?.id);
    }, [stages, editingStage]);

    const handleSaveStage = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const name = formData.get('stageName') as string;
        const predecessorStageId = formData.get('predecessorStageId') as string;

        if(editingStage) {
            updateStage({
                ...editingStage, 
                name,
                predecessorStageId: predecessorStageId || undefined
            });
        } else {
            const maxOrder = Math.max(0, ...stages.map(p => p.order));
            addStage({ 
                name, 
                projectId: project.id, 
                order: maxOrder + 1,
                predecessorStageId: predecessorStageId || undefined
            });
        }
        setIsStageModalOpen(false);
        setEditingStage(undefined);
    }
    
    const handleSaveTask = (taskData: Omit<ProjectTask, 'id'> | ProjectTask) => {
        if('id' in taskData && taskData.id) {
            updateTask(taskData as ProjectTask);
        } else {
            addTask(taskData);
        }
        setIsTaskModalOpen(false);
        setEditingTask(undefined);
    }

    const handleDeleteStage = (stageId: string) => {
        const tasksInStage = projectTasks.filter(t => t.stageId === stageId && t.projectId === project.id);
        if (tasksInStage.length > 0) {
            alert('Não é possível excluir este estágio pois existem tarefas associadas a ele. Remova ou mova as tarefas antes de excluir o estágio.');
            return;
        }
        if (window.confirm('Tem certeza que deseja excluir este estágio?')) {
            deleteStage(stageId);
        }
    };

    return (
        <>
            <div className="flex p-2 space-x-4 overflow-x-auto bg-gray-50 dark:bg-gray-900/50 rounded-lg min-h-[60vh]">
                {stages.map(stage => (
                    <div key={stage.id} className="flex-shrink-0 w-80 rounded-lg p-3 bg-gray-100 dark:bg-gray-900">
                        <div className="flex items-center justify-between mb-4 group">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{stage.name}</h3>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                    onClick={() => { setEditingStage(stage); setIsStageModalOpen(true); }}
                                    className="p-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                                    title="Editar Estágio"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                                <button
                                    onClick={() => handleDeleteStage(stage.id)}
                                    className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                                    title="Excluir Estágio"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                        <div className="h-full space-y-3">
                            {projectTasks.filter(t => t.stageId === stage.id).map(task => (
                                <div key={task.id} onClick={() => { setEditingTask(task); setCurrentStageId(stage.id); setIsTaskModalOpen(true); }} className="p-4 bg-white rounded-lg shadow-sm cursor-pointer dark:bg-gray-800 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <p className={`font-medium text-gray-900 dark:text-white ${task.isCompleted ? 'line-through' : ''}`}>{task.name}</p>
                                        <input type="checkbox" checked={task.isCompleted} onChange={(e) => { e.stopPropagation(); updateTask({...task, isCompleted: e.target.checked})}} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
                                    </p>
                                    {task.predecessorTaskId && (
                                        <p className="text-[10px] text-gray-400 mt-1 flex items-center">
                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                            Dependente
                                        </p>
                                    )}
                                </div>
                            ))}
                            <button onClick={() => { setEditingTask(undefined); setCurrentStageId(stage.id); setIsTaskModalOpen(true); }} className="w-full mt-2 text-sm text-center p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">+ Adicionar Tarefa</button>
                        </div>
                    </div>
                ))}
                 <div className="flex-shrink-0 w-80">
                     <button onClick={() => {setEditingStage(undefined); setIsStageModalOpen(true)}} className="w-full p-3 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">+ Adicionar novo estágio</button>
                </div>
            </div>

            {isStageModalOpen && (
                 <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title={editingStage ? 'Editar Estágio' : 'Novo Estágio'}>
                     <form onSubmit={handleSaveStage} className="space-y-4">
                        <div>
                             <label htmlFor="stageName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome da Fase</label>
                             <input type="text" id="stageName" name="stageName" defaultValue={editingStage?.name || ''} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700" required />
                        </div>
                        <div>
                            <label htmlFor="predecessorStageId" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Fase Anterior (Dependência)</label>
                            <select 
                                id="predecessorStageId" 
                                name="predecessorStageId" 
                                defaultValue={editingStage?.predecessorStageId || ''}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700"
                            >
                                <option value="">Nenhuma</option>
                                {availablePredStages.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">Ao selecionar uma fase anterior, todas as tarefas desta fase serão movidas para iniciar após o término da fase selecionada.</p>
                        </div>
                        <div className="flex justify-end space-x-2">
                             <button type="button" onClick={() => setIsStageModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100">Cancelar</button>
                             <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Salvar</button>
                        </div>
                     </form>
                 </Modal>
            )}

            {isTaskModalOpen && (
                <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}>
                    <TaskForm task={editingTask} stageId={currentStageId} projectId={project.id} onSave={handleSaveTask} onCancel={() => setIsTaskModalOpen(false)} />
                </Modal>
            )}
        </>
    );
};

// --- Sub-component: GanttView ---
const ProjectGanttView: React.FC<{ project: Project }> = ({ project }) => {
    const { projectTasks, projectStages } = useAppContext();
    const [zoomLevel, setZoomLevel] = useState(40); // Pixels per day
    const tasks = useMemo(() => projectTasks.filter(t => t.projectId === project.id), [projectTasks, project.id]);
    const stages = useMemo(() => projectStages.filter(s => s.projectId === project.id).sort((a,b) => a.order - b.order), [projectStages, project.id]);

    const ganttData = useMemo(() => {
        if (tasks.length === 0) return [];
        
        const projectStartDate = new Date(Math.min(...tasks.map(t => new Date(t.startDate).getTime())));
        const projectEndDate = new Date(Math.max(...tasks.map(t => new Date(t.endDate).getTime())));
        
        const data: any[] = [];

        // 0. Add Project Root Node
        const projectDuration = Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 3600 * 24)) + 1;
        
        // Calculate total progress
        const totalProjectTasks = tasks.length;
        const totalCompleted = tasks.filter(t => t.isCompleted).length;
        const projectProgress = totalProjectTasks > 0 ? totalCompleted / totalProjectTasks : 0;

        data.push({
            type: 'project',
            id: project.id,
            wbs: '1',
            displayName: project.name,
            name: project.name,
            startDay: 0,
            duration: projectDuration,
            startDate: projectStartDate,
            endDate: projectEndDate,
            progressPercent: Math.round(projectProgress * 100)
        });

        stages.forEach((stage, stageIndex) => {
            const stageTasks = tasks.filter(t => t.stageId === stage.id).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            
            if (stageTasks.length > 0) {
                // Calculate Stage Metrics
                const stageMinDate = Math.min(...stageTasks.map(t => new Date(t.startDate).getTime()));
                const stageMaxDate = Math.max(...stageTasks.map(t => new Date(t.endDate).getTime()));
                const startDay = Math.floor((stageMinDate - projectStartDate.getTime()) / (1000 * 3600 * 24));
                const duration = Math.ceil((stageMaxDate - stageMinDate) / (1000 * 3600 * 24)) + 1;
                
                const totalTasks = stageTasks.length;
                const completedTasks = stageTasks.filter(t => t.isCompleted).length;
                const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
                
                // Add Stage Row
                data.push({
                    type: 'stage',
                    id: stage.id,
                    wbs: `1.${stageIndex + 1}`,
                    displayName: stage.name, 
                    name: stage.name, 
                    startDay: startDay,
                    duration: duration,
                    startDate: new Date(stageMinDate),
                    endDate: new Date(stageMaxDate),
                    progressPercent: Math.round(progress * 100)
                });

                // Add Task Rows
                stageTasks.forEach((task, taskIndex) => {
                    const taskStartDate = new Date(task.startDate);
                    const taskEndDate = new Date(task.endDate);
                    const taskStartDay = Math.floor((taskStartDate.getTime() - projectStartDate.getTime()) / (1000 * 3600 * 24));
                    
                    data.push({
                        type: 'task',
                        id: task.id,
                        wbs: `1.${stageIndex + 1}.${taskIndex + 1}`,
                        displayName: task.name,
                        name: task.name,
                        startDay: taskStartDay,
                        duration: task.durationDays,
                        startDate: taskStartDate,
                        endDate: taskEndDate,
                        progressPercent: task.isCompleted ? 100 : 0
                    });
                });
            }
        });

        return data;
    }, [tasks, stages, project]);
    
    // Calculate Chart Width for Scroll
    const chartWidth = useMemo(() => {
        if(ganttData.length === 0) return 800;
        const projectItem = ganttData[0]; // Project is always first
        return Math.max(800, (projectItem.duration + 5) * zoomLevel + 400); // 400 is table width
    }, [ganttData, zoomLevel]);

    // Custom Bar Shape to handle thickness and text labels
    const CustomGanttBar = (props: any) => {
        const { x, y, width, height, payload } = props;
        
        // Consistent Bar Height (Thick)
        const barHeight = height * 0.8; 
        const yPos = y + (height - barHeight) / 2;
        
        let color = '#374151'; // Default Gray
        let progressColor = '#4b5563'; // Slightly lighter gray
        
        // Style based on type
        if (payload.type === 'project') {
            color = '#1f2937'; // Dark Gray
            progressColor = '#4b5563';
        } else if (payload.type === 'stage') {
            color = '#1e3a8a'; // Dark Blue background
            progressColor = '#3b82f6'; // Blue progress
        } else { // Task
            color = '#d1fae5'; // Very Light Green background
            progressColor = '#16a34a'; // Green progress
        }

        const progressWidth = (width * payload.progressPercent) / 100;
        const fontSize = 10;
        const textY = y + height / 2 + 4; 
        
        // Text Color based on background
        const insideTextColor = payload.type === 'task' ? '#000' : '#fff';
        const outsideTextColor = '#000';

        // Check if text fits
        const charWidth = 7;
        const startStr = payload.startDate.toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'});
        const endStr = payload.endDate.toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'});
        const durStr = `${payload.duration}d`;
        
        const fullTextWidth = (startStr.length + endStr.length + durStr.length) * charWidth + 20;
        const fitsInside = width > fullTextWidth;

        return (
            <g>
                {/* Background Bar */}
                <rect x={x} y={yPos} width={width} height={barHeight} fill={payload.type === 'task' ? color : '#e5e7eb'} rx={4} />
                
                {/* Progress Bar */}
                <rect x={x} y={yPos} width={progressWidth} height={barHeight} fill={progressColor} rx={4} />
                
                {/* Text Labels */}
                {fitsInside ? (
                    <>
                         {/* Start Date (Left) */}
                        <text x={x + 4} y={textY} textAnchor="start" fontSize={fontSize} fill={insideTextColor} fontWeight="bold">
                            {startStr}
                        </text>

                         {/* Duration (Center) */}
                        <text x={x + width / 2} y={textY} textAnchor="middle" fontSize={fontSize} fill={insideTextColor}>
                            {durStr}
                        </text>

                        {/* End Date (Right) */}
                        <text x={x + width - 4} y={textY} textAnchor="end" fontSize={fontSize} fill={outsideTextColor} fontWeight="bold">
                            {endStr}
                        </text>
                    </>
                ) : (
                    // Render Outside (Right)
                    <text x={x + width + 5} y={textY} textAnchor="start" fontSize={fontSize} fill={outsideTextColor}>
                        {startStr} - {endStr} ({durStr})
                    </text>
                )}
            </g>
        );
    };

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: any }[] }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const isStage = data.type === 'stage';
            const isProject = data.type === 'project';
            
            let typeLabel = 'Tarefa';
            if (isStage) typeLabel = 'Fase';
            if (isProject) typeLabel = 'Projeto';

            return (
                <div className="p-3 bg-gray-700 text-white rounded-md shadow-lg border border-gray-600 z-50">
                    <p className={`font-bold text-lg mb-1 ${isStage ? 'text-blue-300' : (isProject ? 'text-gray-300' : 'text-green-300')}`}>
                        {data.name} <span className="text-xs font-normal">({typeLabel})</span>
                    </p>
                    <div className="text-sm space-y-1">
                        <p>Início: {data.startDate.toLocaleDateString('pt-BR')}</p>
                        <p>Fim: {data.endDate.toLocaleDateString('pt-BR')}</p>
                        <p>Duração: {data.duration} dia(s)</p>
                        <p>Progresso: {data.progressPercent}%</p>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Custom Y Axis Tick Component to render "Table" columns
    const CustomYAxisTick = (props: any) => {
        const { x, y, payload } = props;
        const entry = ganttData[payload.index]; 
        if (!entry) return null;

        const isProject = entry.type === 'project';
        const isStage = entry.type === 'stage';
        
        let fontWeight = 'normal';
        if (isProject) fontWeight = '900';
        else if (isStage) fontWeight = 'bold';

        const fontSize = 12;
        const indent = isProject ? 0 : (isStage ? 10 : 30);

        // Base X position for the columns relative to the YAxis right edge
        const xBase = x - 400; 

        return (
            <g transform={`translate(${xBase},${y})`}>
                {/* WBS */}
                <text x={10} y={4} textAnchor="start" fontWeight={fontWeight} fontSize={fontSize} fill={isProject ? "#000" : (isStage ? "#111" : "#444")}>{entry.wbs}</text>
                
                {/* Name */}
                <text x={50 + indent} y={4} textAnchor="start" fontWeight={fontWeight} fontSize={fontSize} fill={isProject ? "#000" : (isStage ? "#111" : "#444")}>
                    {entry.displayName.length > 22 ? entry.displayName.substring(0, 20) + '...' : entry.displayName}
                </text>

                {/* Duration */}
                <text x={240} y={4} textAnchor="start" fontSize={fontSize} fill="#555" fontWeight={isProject ? 'bold' : 'normal'}>
                    {entry.duration}d
                </text>

                {/* Start Date */}
                <text x={290} y={4} textAnchor="start" fontSize={fontSize} fill="#555">
                    {entry.startDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                </text>

                {/* End Date */}
                 <text x={350} y={4} textAnchor="start" fontSize={fontSize} fill="#555">
                    {entry.endDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                </text>
            </g>
        );
    };

    if (tasks.length === 0) {
        return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Nenhuma tarefa para exibir no gráfico de Gantt.</div>;
    }

    if (ganttData.length === 0) {
        return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Adicione tarefas aos estágios para visualizar o cronograma.</div>;
    }

    return (
         <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 min-h-[60vh] overflow-hidden flex flex-col">
             {/* Toolbar */}
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cronograma</h3>
                 <div className="flex items-center space-x-2">
                     <span className="text-sm text-gray-500 dark:text-gray-400">Zoom:</span>
                     <button onClick={() => setZoomLevel(z => Math.max(10, z - 10))} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">-</button>
                     <span className="text-sm font-medium w-8 text-center">{Math.round(zoomLevel / 10)}x</span>
                     <button onClick={() => setZoomLevel(z => Math.min(100, z + 10))} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">+</button>
                 </div>
             </div>

             {/* Header for the "Table" part */}
             <div className="flex border-b border-gray-200 dark:border-gray-700 mb-2 pb-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider" style={{ width: '100%', minWidth: chartWidth }}>
                 <div style={{ width: '400px', display: 'flex', flexShrink: 0 }} className="bg-gray-50 dark:bg-gray-700/50 rounded p-1">
                     <div style={{ width: '50px' }}>Item</div>
                     <div style={{ width: '190px' }}>Nome</div>
                     <div style={{ width: '50px' }}>Dur.</div>
                     <div style={{ width: '60px' }}>Início</div>
                     <div style={{ width: '50px' }}>Fim</div>
                 </div>
                 <div className="flex-1 pl-4 p-1 bg-blue-50 dark:bg-blue-900/20 rounded ml-2 text-center text-blue-800 dark:text-blue-200">Cronograma Visual</div>
             </div>

            <div className="overflow-x-auto flex-1">
                <div style={{ width: chartWidth, minWidth: '100%' }}>
                    <ResponsiveContainer width="100%" height={Math.max(400, ganttData.length * 40 + 40)}>
                        <ComposedChart
                            layout="vertical"
                            data={ganttData}
                            margin={{ top: 0, right: 20, left: 0, bottom: 20 }}
                            barCategoryGap={8} // Space between bars
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} strokeOpacity={0.2}/>
                            {/* Primary XAxis for bars */}
                            <XAxis type="number" xAxisId={0} orientation="top" dataKey="startDay" hide />

                            <YAxis 
                                type="category" 
                                dataKey="wbs" // Use unique key
                                width={400} // Allocating space for the "Table"
                                tick={<CustomYAxisTick />}
                                interval={0} // Show all ticks
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                            
                            {/* Transparent bar to offset start date */}
                            <Bar dataKey="startDay" stackId="a" fill="transparent" />
                            
                            {/* Custom Bar for Total Duration (Using custom shape for styling and text) */}
                            <Bar dataKey="duration" stackId="a" isAnimationActive={false} shape={<CustomGanttBar />} />

                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// --- Sub-component: ProjectProductsTab ---
const ProjectProductsTab: React.FC<{ project: Project }> = ({ project }) => {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Gerenciamento de Entregas (Em Desenvolvimento).</div>
}

// --- Sub-component: ProjectDocumentsTab ---
const ProjectDocumentsTab: React.FC<{ project: Project }> = ({ project }) => {
    const { updateProject } = useAppContext();
    const [lessonsLearned, setLessonsLearned] = useState(project.lessonsLearned || '');
    const isEditable = project.status === ProjectStatus.COMPLETED || project.status === ProjectStatus.CANCELED;

    const handleSave = () => {
        updateProject({ ...project, lessonsLearned });
    }

    return (
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Business Case</h3>
                <p className="text-gray-600 dark:text-gray-300 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg whitespace-pre-wrap">
                    {project.businessCase || 'Nenhum business case definido.'}
                </p>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Lições Aprendidas</h3>
                <textarea 
                    value={lessonsLearned}
                    onChange={(e) => setLessonsLearned(e.target.value)}
                    rows={8}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600"
                    placeholder={isEditable ? "Descreva o que foi aprendido durante o projeto..." : "Disponível após a conclusão do projeto."}
                    readOnly={!isEditable}
                />
                {isEditable && (
                    <div className="flex justify-end mt-2">
                        <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Salvar Lições</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Sub-component: ProjectDashboardTab ---
const ProjectDashboardTab: React.FC<{ project: Project }> = ({ project }) => {
    const { contacts, projectTasks } = useAppContext();
    const client = contacts.find(c => c.id === project.clientId);
    const progress = useMemo(() => {
        const tasks = projectTasks.filter(t => t.projectId === project.id);
        if (tasks.length === 0) return 0;
        const completedTasks = tasks.filter(t => t.isCompleted).length;
        return Math.round((completedTasks / tasks.length) * 100);
    }, [projectTasks, project.id]);

    const InfoCard: React.FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h4>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{children}</div>
        </div>
    );
    
    return (
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InfoCard title="Cliente">{client?.name || 'N/A'}</InfoCard>
                <InfoCard title="Gerente do Projeto">{project.projectManager || 'N/A'}</InfoCard>
                <InfoCard title="Status">{project.status}</InfoCard>
                <InfoCard title="Data de Início">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}</InfoCard>
                <InfoCard title="Data Final">{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}</InfoCard>
            </div>
            <div>
                 <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Progresso Geral</h4>
                <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                    <div className="bg-primary-600 h-4 rounded-full text-center text-white text-xs" style={{ width: `${progress}%` }}>
                       {progress > 10 && `${progress}%`}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Sub-component: ProjectDetailView ---
const ProjectDetailView: React.FC<{ project: Project; onBack: () => void }> = ({ project, onBack }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'stages' | 'gantt' | 'products' | 'documents'>('dashboard');

    const TabButton: React.FC<{ title: string; tabName: typeof activeTab; }> = ({ title, tabName }) => (
         <button onClick={() => setActiveTab(tabName)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tabName ? 'bg-white dark:bg-gray-800 text-primary-600 shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}>
            {title}
        </button>
    );

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center text-sm font-medium text-primary-600 hover:underline dark:text-primary-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                Voltar para a lista de projetos
            </button>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                 <div className="flex mt-4 md:mt-0 items-center p-1 space-x-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
                    <TabButton title="Painel" tabName="dashboard" />
                    <TabButton title="Estágios" tabName="stages" />
                    <TabButton title="Gantt" tabName="gantt" />
                    <TabButton title="Entregas" tabName="products" />
                    <TabButton title="Documentos" tabName="documents" />
                </div>
            </div>

            <div className="mt-4">
                {activeTab === 'dashboard' && <ProjectDashboardTab project={project} />}
                {activeTab === 'stages' && <ProjectStagesView project={project} />}
                {activeTab === 'gantt' && <ProjectGanttView project={project} />}
                {activeTab === 'products' && <ProjectProductsTab project={project} />}
                {activeTab === 'documents' && <ProjectDocumentsTab project={project} />}
            </div>
        </div>
    );
};

// --- Sub-component: Project Initiation Modal ---
const ProjectInitiationModal: React.FC<{ project: Project; onSave: (updatedProject: Project) => void; onCancel: () => void; }> = ({ project, onSave, onCancel }) => {
    const [businessCase, setBusinessCase] = useState('');
    const [projectManager, setProjectManager] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedProject: Project = {
            ...project,
            status: ProjectStatus.IN_PROGRESS,
            businessCase,
            projectManager,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
        };
        onSave(updatedProject);
    };

    return (
        <Modal isOpen={true} onClose={onCancel} title={`Iniciar Projeto: ${project.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="businessCase" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Business Case (Justificativa)</label>
                    <textarea id="businessCase" value={businessCase} onChange={e => setBusinessCase(e.target.value)} rows={4} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700" required />
                </div>
                <div>
                    <label htmlFor="projectManager" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Gerente do Projeto</label>
                    <input type="text" id="projectManager" value={projectManager} onChange={e => setProjectManager(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700" required />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="startDate" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data de Início</label>
                        <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700" required />
                    </div>
                     <div>
                        <label htmlFor="endDate" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data Final Prevista</label>
                        <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700" required />
                    </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                     <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100">Cancelar</button>
                     <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Iniciar Projeto</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Sub-component: New Project Form ---
const ProjectForm: React.FC<{ onSave: (project: Omit<Project, 'id'>) => void; onCancel: () => void; }> = ({ onSave, onCancel }) => {
    const { contacts } = useAppContext();
    const [name, setName] = useState('');
    const [clientId, setClientId] = useState('');
    const clientContacts = useMemo(() => contacts.filter(c => c.type === ContactType.CLIENT), [contacts]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            clientId,
            status: ProjectStatus.NOT_STARTED
        });
    };

    return (
         <Modal isOpen={true} onClose={onCancel} title="Criar Novo Projeto">
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="projectName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome do Projeto</label>
                    <input type="text" id="projectName" value={name} onChange={e => setName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700" required />
                </div>
                 <div>
                    <label htmlFor="client" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Cliente</label>
                    <select id="client" value={clientId} onChange={e => setClientId(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 block w-full p-2.5 dark:bg-gray-700" required>
                        <option value="">Selecione um Cliente</option>
                        {clientContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                     <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100">Cancelar</button>
                     <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Criar Projeto</button>
                </div>
            </form>
        </Modal>
    );
}

// --- Main Page Component ---
const ProjectsPage: React.FC = () => {
    const { projects, contacts, projectTasks, addProject, updateProject } = useAppContext();
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [projectToInitiate, setProjectToInitiate] = useState<Project | null>(null);
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

    const getProjectProgress = (projectId: string) => {
        const tasks = projectTasks.filter(t => t.projectId === projectId);
        if (tasks.length === 0) return 0;
        const completedTasks = tasks.filter(t => t.isCompleted).length;
        return Math.round((completedTasks / tasks.length) * 100);
    };

    const handleSaveInitiation = (updatedProject: Project) => {
        updateProject(updatedProject);
        setProjectToInitiate(null);
    };
    
    const handleSaveNewProject = (projectData: Omit<Project, 'id'>) => {
        addProject(projectData);
        setIsNewProjectModalOpen(false);
    }

    if (selectedProject) {
        return <ProjectDetailView project={selectedProject} onBack={() => setSelectedProject(null)} />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projetos</h1>
                 <button onClick={() => setIsNewProjectModalOpen(true)} className="mt-4 md:mt-0 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300">Novo Projeto</button>
            </div>
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome do Projeto</th>
                            <th scope="col" className="px-6 py-3">Cliente</th>
                            <th scope="col" className="px-6 py-3">Gerente</th>
                            <th scope="col" className="px-6 py-3">Datas</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                            <th scope="col" className="px-6 py-3">Progresso</th>
                            <th scope="col" className="px-6 py-3"><span className="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map(project => {
                            const client = contacts.find(c => c.id === project.clientId);
                            const progress = getProjectProgress(project.id);
                            return (
                                <tr key={project.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{project.name}</th>
                                    <td className="px-6 py-4">{client?.name || 'N/A'}</td>
                                    <td className="px-6 py-4">{project.projectManager || 'N/A'}</td>
                                    <td className="px-6 py-4">{project.startDate ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate || '').toLocaleDateString()}`: 'N/A'}</td>
                                    <td className="px-6 py-4">{project.status}</td>
                                    <td className="px-6 py-4">
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                            <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                         {project.status === ProjectStatus.NOT_STARTED ? (
                                            <button onClick={() => setProjectToInitiate(project)} className="font-medium text-green-600 dark:text-green-500 hover:underline">Iniciar Projeto</button>
                                        ) : (
                                            <button onClick={() => setSelectedProject(project)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Gerenciar</button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {projects.length === 0 && (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">Nenhum projeto encontrado.</div>
                )}
            </div>

            {isNewProjectModalOpen && <ProjectForm onSave={handleSaveNewProject} onCancel={() => setIsNewProjectModalOpen(false)} />}
            {projectToInitiate && <ProjectInitiationModal project={projectToInitiate} onSave={handleSaveInitiation} onCancel={() => setProjectToInitiate(null)} />}
        </div>
    );
};

export default ProjectsPage;
