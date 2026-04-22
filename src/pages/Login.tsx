import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Users, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
        const cleanUsername = username.trim();
        const cleanPassword = password.trim();
        
        let { data: foundPersonnel, error } = await supabase
          .from('personnel')
          .select('*')
          .eq('tc_no', cleanUsername)
          .eq('is_active', true)
          .maybeSingle();

        // Auto-retry once for Supabase lock collision
        if (error && error.message && error.message.includes('stole it')) {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('lock:sb-') || key.startsWith('sb-')) {
              localStorage.removeItem(key);
            }
          });
          await supabase.auth.signOut().catch(() => {});
          await new Promise(r => setTimeout(r, 500));
          
          const retry = await supabase.from('personnel').select('*').eq('tc_no', cleanUsername).eq('is_active', true).maybeSingle();
          foundPersonnel = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error("Supabase error during personnel login:", error);
          toast.error(`Sistem hatası: ${error.message}`);
          setIsLoading(false);
          return;
        }

        if (foundPersonnel && cleanPassword === foundPersonnel.password_hash) {
          setMockUser({ 
            isAdmin: false, 
            email: foundPersonnel.tc_no, 
            id: foundPersonnel.id,
            name: `${foundPersonnel.first_name} ${foundPersonnel.last_name}`
          });
          toast.success(`Hoş geldiniz ${foundPersonnel.first_name}!`);
          navigate('/');
        } else {
          toast.error('Kullanıcı adı veya şifre hatalı veya hesabınız pasif!');
        }
        setIsLoading(false);
        return;
      }

      const email = username.includes('@') ? username : `${username}@paulmark.com`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        toast.success('Giriş başarılı!');
        navigate('/');
      } else {
        toast.error('Giriş yapılamadı.');
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
          <h1 className="text-3xl font-bold text-foreground">PAULMARK PERSONEL TAKİBİ</h1>
          <p className="text-muted-foreground mt-2 font-medium">Tasarlayan Turgay DOLU</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl">Giriş Yap</CardTitle>
            <CardDescription>
              {userType === 'admin' ? 'Müdür/Admin girişi' : 'Personel girişi'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setUserType('personnel')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${userType === 'personnel'
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
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${userType === 'admin'
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
                <Label htmlFor="username">{userType === 'admin' ? 'Kullanıcı Adı (Müdür)' : 'Kullanıcı Adı (TC No)'}</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={userType === 'admin' ? 'admin' : 'Kullanıcı adınızı girin'}
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

              <div className="bg-secondary/50 p-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">💡 Bilgi:</p>
                <p className="text-sm">Kullanıcı adı ve şifre ile giriş yapabilirsiniz.</p>
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
