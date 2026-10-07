// Prints one bcrypt hash per argument, feeding make db-hash for db/run.sql.
// Run as a single-file source program against the spring-security-crypto jar.
public class BcryptHash {
	public static void main(String[] args) {
		if (args.length == 0) {
			System.err.println("usage: BcryptHash <password>...");
			System.exit(1);
		}
		var encoder = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
		for (String password : args) {
			System.out.println(password + " " + encoder.encode(password));
		}
	}
}
