
import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Spinner from '../components/Spinner';

const UserProfile: React.FC = () => {
    const { user, updateProfile, signOut, deleteAccount } = useAuth();
    const [name, setName] = useState(user?.user_metadata?.full_name || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Webcam refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const { error } = await updateProfile({ full_name: name, avatar_url: avatarUrl });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil.' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Tem certeza que deseja solicitar a exclusão da sua conta? Esta ação não pode ser desfeita.")) {
            await deleteAccount();
        }
    };

    const uploadAvatar = async (file: File | Blob) => {
        try {
            setUploading(true);
            const fileExt = 'png';
            const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            setAvatarUrl(data.publicUrl);
            setMessage({ type: 'success', text: 'Imagem carregada com sucesso! Clique em Salvar Alterações.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Erro ao carregar imagem' });
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return;
        }
        uploadAvatar(event.target.files[0]);
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setIsCameraOpen(true);
        } catch (err) {
            console.error("Error accessing camera:", err);
            setMessage({ type: 'error', text: 'Não foi possível acessar a câmera.' });
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraOpen(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                canvasRef.current.toBlob(blob => {
                    if (blob) {
                        uploadAvatar(blob);
                        stopCamera();
                    }
                }, 'image/png');
            }
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meu Perfil</h1>
                <button onClick={signOut} className="text-sm text-red-600 hover:underline dark:text-red-400 font-medium">Sair da Conta</button>
            </div>

            <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <div className="flex flex-col items-center sm:flex-row sm:space-x-4 mb-6">
                    <div className="relative group">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-3xl font-bold border-2 border-gray-200 dark:border-gray-700">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                        )}
                         {uploading && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                                 <Spinner size="sm" />
                             </div>
                         )}
                    </div>
                    
                    <div className="flex flex-col space-y-2 mt-4 sm:mt-0">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center sm:text-left">{user?.email}</h2>
                        <div className="flex space-x-2 justify-center sm:justify-start">
                            <label className="cursor-pointer px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600">
                                Upload Foto
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={uploading} />
                            </label>
                            <button 
                                type="button" 
                                onClick={startCamera} 
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700"
                            >
                                Usar Webcam
                            </button>
                        </div>
                    </div>
                </div>

                {isCameraOpen && (
                    <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg flex flex-col items-center">
                        <video ref={videoRef} autoPlay className="w-full max-w-sm rounded-lg mb-2" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex space-x-2">
                             <button onClick={takePhoto} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Tirar Foto</button>
                             <button onClick={stopCamera} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Cancelar</button>
                        </div>
                    </div>
                )}

                {message && (
                    <div className={`p-4 mb-4 text-sm rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-4">
                    <div>
                        <label htmlFor="fullName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome Completo</label>
                        <input
                            type="text"
                            id="fullName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    <div>
                        <label htmlFor="avatarUrl" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">URL do Avatar (opcional)</label>
                        <input
                            type="text"
                            id="avatarUrl"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://exemplo.com/foto.jpg"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <p className="mt-1 text-xs text-gray-500">Você pode colar uma URL ou usar os botões acima para enviar uma imagem.</p>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                         <button type="button" onClick={handleDelete} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir Conta</button>
                         <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 disabled:opacity-50">
                             {loading ? <Spinner size="sm" /> : 'Salvar Alterações'}
                         </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserProfile;
