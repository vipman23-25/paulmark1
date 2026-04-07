import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Users, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { mockDb } from '@/services/mockDatabase';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<'personnel' | 'admin'>('personnel');
  const navigate = useNavigate();
  const { setMockUser } = useAuth() as any;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (userType === 'personnel') {
        // Check against mockDb personnel
        const allPersonnel = mockDb.getAllPersonnel();
        const foundPersonnel = allPersonnel.find(
          (p) => p.username === username && p.password_hash === password
        );

        if (foundPersonnel) {
          setMockUser({ 
            isAdmin: false, 
            email: foundPersonnel.username, 
            id: foundPersonnel.id,
            name: `${foundPersonnel.first_name} ${foundPersonnel.last_name}`
          });
          toast.success(`Hoş geldiniz ${foundPersonnel.first_name}!`);
          navigate('/');
        } else {
          toast.error('Kullanıcı adı veya şifre hatalı!');
        }
      } else if (userType === 'admin') {
        // Admin hardcoded credentials
        if (username === 'admin' && password === 'admin') {
          setMockUser({ isAdmin: true, email: 'admin@example.com', name: 'Admin' });
          toast.success('Admin girişi başarılı!');
          navigate('/');
        } else {
          toast.error('Admin bilgileri hatalı!');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Giriş sırasında hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Personel Yönetimi</h1>
          <p className="text-muted-foreground mt-2">Sisteme giriş yapın</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl">Giriş Yap</CardTitle>
            <CardDescription>
              {userType === 'admin' ? 'Müdür/Admin girişi' : 'Personel girişi'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Tab Selection */}
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setUserType('personnel')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  userType === 'personnel'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Personel
              </button>
              <button
                type="button"
                onClick={() => setUserType('admin')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  userType === 'admin'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Müdür
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={userType === 'admin' ? 'admin' : 'personel'}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={userType === 'admin' ? 'admin' : 'personel'}
                  required
                />
              </div>

              {/* Test Credentials Info */}
              <div className="bg-secondary/50 p-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">💡 Bilgi:</p>
                {userType === 'admin' ? (
                  <>
                    <p>👤 Müdür Adı: <span className="font-mono">admin</span></p>
                    <p>🔑 Şifre: <span className="font-mono">admin</span></p>
                  </>
                ) : (
                  <>
                    <p className="text-xs">Müdür tarafından eklenen personellerin</p>
                    <p className="text-xs">kullanıcı adı ve şifresi ile giriş yapabilirsiniz.</p>
                    <div className="mt-2 pt-2 border-t border-secondary">
                      <p className="text-xs font-semibold">Örnek Test Personeli:</p>
                      <p>👤 Kullanıcı: <span className="font-mono">ahmet</span></p>
                      <p>🔑 Şifre: <span className="font-mono">pass123</span></p>
                    </div>
                  </>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                <Users className="w-4 h-4 mr-2" />
                {isLoading ? 'Yükleniyor...' : 'Giriş Yap'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
